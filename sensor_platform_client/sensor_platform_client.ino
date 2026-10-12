/*
 * ============================================================================
 * FileVault — ESP32 Sensor Platform Client (v4.1 Performance Optimized)
 * ============================================================================
 * Hardware : ESP32 Dev Module
 * Serial   : UART2 ONLY (GPIO 16 = RX2, GPIO 17 = TX2, 115200 baud)
 *            UART0 (USB) is reserved strictly for flashing firmware.
 *
 * Wiring (USB-to-Serial Adapter <-> ESP32):
 *   Adapter TX  ---> ESP32 GPIO 16 (RX2)
 *   Adapter RX  <--- ESP32 GPIO 17 (TX2)
 *   Adapter GND <--> ESP32 GND
 *
 * Features & Performance Optimizations:
 *   1. Interactive WiFi Provisioning over UART2 with NVS persistence (up to 5
 *      networks, auto-connect on boot, FIFO eviction).
 *   2. Automatic Sensor Registration on connect + automatic detection when
 *      SENSOR_ID constant is changed in code.
 *   3. O(1) Fast Sensor Authentication: sends `X-Sensor-Id` alongside
 *      `Authorization: Bearer <token>` so the server verifies the token via
 *      direct indexed lookup instead of scanning all devices.
 *   4. TLS Session Reuse (`http.setReuse(true)`) on a single global
 *      `WiFiClientSecure` instance to avoid repeated SSL handshakes on
 *      back-to-back calls (e.g. Version Check -> Auto Config Download).
 *   5. 4-Option Interactive Menu on UART2:
 *        [1] Heartbeat (with live heap, RSSI, uptime telemetry)
 *        [2] Upload Data (up to 5 MB via UART2 RX stream or demo CSV fallback)
 *        [3] Check Version (auto-downloads config to SPIFFS `/config.json`,
 *            streams between <<<CONFIG_START>>> / <<<CONFIG_END>>> on UART2 TX,
 *            updates NVS version, and syncs new version to server)
 *        [4] Re-registration (clears NVS token & re-registers immediately)
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SPIFFS.h>

// ======================= USER CONFIGURATION =======================
const char* SERVER_BASE_URL  = "https://my-project-ktbuf3wok-ak-63.vercel.app";
const char* SENSOR_ID        = "ESP32-SENSOR-01";  // Change per board (uppercase alphanumeric/hyphens)
const char* FIRMWARE_VERSION = "4.1.0";
const char* HARDWARE_MODEL   = "ESP32-WROOM-32";

// UART2 Configuration (ALL user/PC communication happens here)
#define UART2_BAUD   115200
#define UART2_RX_PIN 16
#define UART2_TX_PIN 17

// Limits & Timeouts
static const size_t   MAX_FILE_BYTES      = 5UL * 1024UL * 1024UL; // 5 MB max upload size
static const uint32_t HTTP_TIMEOUT_MS     = 15000;                 // 15s for serverless cold starts
static const uint32_t WIFI_CONNECT_MS     = 20000;                 // 20s per saved WiFi attempt
static const uint32_t UPLOAD_IDLE_WAIT_MS = 5000;                  // 5s wait for UART2 file stream
static const int      MAX_SAVED_WIFI      = 5;                     // Max WiFi networks in NVS

// ======================= GLOBAL STATE =============================
WiFiClientSecure secureClient;
Preferences      prefs;

String savedToken      = "";
String savedSensorId   = "";
String savedCfgVersion = "0.0.0";

// ======================= UART2 I/O HELPERS ========================
void s2print(const String& msg) {
  Serial2.print(msg);
}

void s2println(const String& msg = "") {
  Serial2.println(msg);
}

void s2printf(const char* fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  Serial2.print(buf);
}

/** Flush any stray bytes in UART2 RX buffer */
void clearUart2Rx() {
  while (Serial2.available()) {
    Serial2.read();
  }
}

/** Blocking line reader from UART2 RX (trims CR/LF) */
String readLineFromUart2() {
  String line = "";
  while (true) {
    if (Serial2.available()) {
      char c = (char)Serial2.read();
      if (c == '\n') {
        line.trim();
        return line;
      } else if (c != '\r') {
        line += c;
      }
    }
    delay(5);
  }
}

// ======================= JSON STRING EXTRACTOR ====================
/** Lightweight helper to extract a string field from flat JSON responses */
String extractJsonString(const String& json, const char* key) {
  String pattern = String("\"") + key + "\"";
  int keyIdx = json.indexOf(pattern);
  if (keyIdx < 0) return "";

  int colonIdx = json.indexOf(':', keyIdx + pattern.length());
  if (colonIdx < 0) return "";

  int pos = colonIdx + 1;
  while (pos < (int)json.length() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\n' || json[pos] == '\r')) {
    pos++;
  }
  if (pos >= (int)json.length()) return "";

  // Check for null
  if (json.substring(pos, pos + 4) == "null") return "";

  if (json[pos] == '"') {
    int start = pos + 1;
    int end = start;
    while (end < (int)json.length()) {
      if (json[end] == '"' && json[end - 1] != '\\') break;
      end++;
    }
    return json.substring(start, end);
  }

  // Boolean or number token
  int end = pos;
  while (end < (int)json.length() && json[end] != ',' && json[end] != '}' && json[end] != ' ' && json[end] != '\n' && json[end] != '\r') {
    end++;
  }
  return json.substring(pos, end);
}

// ======================= NVS: SENSOR CREDENTIALS ==================
void loadSensorPrefs() {
  prefs.begin("sensor", false);
  savedToken      = prefs.getString("token", "");
  savedSensorId   = prefs.getString("sensorId", "");
  savedCfgVersion = prefs.getString("cfgVersion", "0.0.0");

  // Detect if SENSOR_ID constant in sketch was changed since last flash
  if (savedSensorId.length() > 0 && !savedSensorId.equalsIgnoreCase(SENSOR_ID)) {
    s2println("\n[NVS] Detected SENSOR_ID change (" + savedSensorId + " -> " + String(SENSOR_ID) + ").");
    s2println("[NVS] Clearing previous sensor token and resetting config version to 0.0.0...");
    prefs.clear();
    savedToken      = "";
    savedSensorId   = String(SENSOR_ID);
    savedCfgVersion = "0.0.0";
    prefs.putString("sensorId", savedSensorId);
    prefs.putString("cfgVersion", savedCfgVersion);
  }
  prefs.end();
}

void saveSensorPrefs(const String& token, const String& sensorId, const String& cfgVersion) {
  prefs.begin("sensor", false);
  prefs.putString("token", token);
  prefs.putString("sensorId", sensorId);
  prefs.putString("cfgVersion", cfgVersion);
  prefs.end();

  savedToken      = token;
  savedSensorId   = sensorId;
  savedCfgVersion = cfgVersion;
}

void clearSensorPrefs() {
  prefs.begin("sensor", false);
  prefs.clear();
  prefs.end();

  savedToken      = "";
  savedSensorId   = String(SENSOR_ID);
  savedCfgVersion = "0.0.0";
}

// ======================= NVS: WIFI PROVISIONING ===================
void saveWiFiCredential(const String& ssid, const String& password) {
  prefs.begin("wifi", false);
  int count = prefs.getInt("count", 0);

  // If SSID already exists, update its password in-place
  for (int i = 0; i < count; i++) {
    String existingSsid = prefs.getString(("ssid" + String(i)).c_str(), "");
    if (existingSsid == ssid) {
      prefs.putString(("pass" + String(i)).c_str(), password);
      prefs.end();
      s2println("[WiFi] Updated credentials in NVS for: " + ssid);
      return;
    }
  }

  // Otherwise append or FIFO-evict oldest slot (index 0)
  if (count < MAX_SAVED_WIFI) {
    prefs.putString(("ssid" + String(count)).c_str(), ssid);
    prefs.putString(("pass" + String(count)).c_str(), password);
    prefs.putInt("count", count + 1);
  } else {
    for (int i = 0; i < MAX_SAVED_WIFI - 1; i++) {
      prefs.putString(("ssid" + String(i)).c_str(), prefs.getString(("ssid" + String(i + 1)).c_str(), ""));
      prefs.putString(("pass" + String(i)).c_str(), prefs.getString(("pass" + String(i + 1)).c_str(), ""));
    }
    prefs.putString(("ssid" + String(MAX_SAVED_WIFI - 1)).c_str(), ssid);
    prefs.putString(("pass" + String(MAX_SAVED_WIFI - 1)).c_str(), password);
    prefs.putInt("count", MAX_SAVED_WIFI);
  }

  prefs.end();
  s2println("[WiFi] Saved network credentials to NVS: " + ssid);
}

bool connectToWiFiNetwork(const String& ssid, const String& password, uint32_t timeoutMs) {
  s2print("[WiFi] Connecting to \"" + ssid + "\" ");
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);

  if (password.length() > 0) {
    WiFi.begin(ssid.c_str(), password.c_str());
  } else {
    WiFi.begin(ssid.c_str());
  }

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
    delay(400);
    s2print(".");
  }
  s2println();

  if (WiFi.status() == WL_CONNECTED) {
    s2println("[WiFi] Connected! IP: " + WiFi.localIP().toString() + " | RSSI: " + String(WiFi.RSSI()) + " dBm");
    return true;
  }

  s2println("[WiFi] Connection failed or timed out for \"" + ssid + "\".");
  return false;
}

void interactiveWiFiProvisioning() {
  while (WiFi.status() != WL_CONNECTED) {
    s2println("\n[WiFi] Scanning for available 2.4GHz networks...");
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);

    int n = WiFi.scanNetworks();
    if (n <= 0) {
      s2println("[WiFi] No networks found. Retrying scan in 3 seconds...");
      delay(3000);
      continue;
    }

    s2println("\n  Available WiFi Networks:");
    for (int i = 0; i < n; i++) {
      String auth = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "open" : "secured";
      s2printf("    [%d] %-24s  %d dBm  [%s]\r\n",
               i + 1,
               WiFi.SSID(i).c_str(),
               WiFi.RSSI(i),
               auth.c_str());
    }

    clearUart2Rx();
    s2print("\n  Enter network number (1-" + String(n) + ") or 0 to rescan: ");
    String choiceStr = readLineFromUart2();
    s2println(choiceStr);

    int choice = choiceStr.toInt();
    if (choice <= 0 || choice > n) {
      s2println("  [!] Rescanning networks...");
      continue;
    }

    String selectedSsid = WiFi.SSID(choice - 1);
    bool isOpen = (WiFi.encryptionType(choice - 1) == WIFI_AUTH_OPEN);
    String password = "";

    if (!isOpen) {
      clearUart2Rx();
      s2print("  Enter password for \"" + selectedSsid + "\": ");
      password = readLineFromUart2();
      s2println("********");
    }

    if (connectToWiFiNetwork(selectedSsid, password, WIFI_CONNECT_MS)) {
      saveWiFiCredential(selectedSsid, password);
      WiFi.scanDelete();
      return;
    }

    s2println("  [!] Could not connect. Please select a network and try again.");
  }
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  prefs.begin("wifi", true);
  int savedCount = prefs.getInt("count", 0);
  prefs.end();

  if (savedCount > 0) {
    s2println("[WiFi] Found " + String(savedCount) + " saved network(s) in NVS. Scanning to match available SSIDs...");
    int visible = WiFi.scanNetworks();

    prefs.begin("wifi", true);
    for (int i = savedCount - 1; i >= 0; i--) { // Try most recently saved first
      String ssid = prefs.getString(("ssid" + String(i)).c_str(), "");
      String pass = prefs.getString(("pass" + String(i)).c_str(), "");
      if (ssid.length() == 0) continue;

      // Check if saved SSID is visible in scan results
      bool isVisible = false;
      for (int j = 0; j < visible; j++) {
        if (WiFi.SSID(j) == ssid) {
          isVisible = true;
          break;
        }
      }

      if (isVisible) {
        prefs.end();
        if (connectToWiFiNetwork(ssid, pass, WIFI_CONNECT_MS)) {
          WiFi.scanDelete();
          return;
        }
        prefs.begin("wifi", true);
      }
    }
    prefs.end();
    WiFi.scanDelete();
    s2println("[WiFi] Saved networks not in range or failed to connect.");
  } else {
    s2println("[WiFi] No saved networks found in NVS.");
  }

  interactiveWiFiProvisioning();
}

// ======================= HTTP REQUEST HELPERS =====================
bool beginRequest(HTTPClient& http, const String& url) {
  secureClient.setInsecure(); // Skip CA bundle verification on ESP32
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setReuse(true);        // Reuse TLS connection across back-to-back requests
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  return http.begin(secureClient, url);
}

/**
 * Adds both Authorization Bearer token AND X-Sensor-Id header.
 * Sending X-Sensor-Id enables the server's O(1) indexed token verification
 * instead of scanning all sensors in the database.
 */
void addAuthHeaders(HTTPClient& http) {
  if (savedToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + savedToken);
  }
  http.addHeader("X-Sensor-Id", SENSOR_ID);
}

// ======================= FORWARD DECLARATIONS =====================
bool registerSensor();
void sendHeartbeat(bool silent = false);
void uploadData();
void checkVersion();
bool downloadConfig(const String& expectedVersion);
void reRegister();
void printMenu();

// ======================= 0. AUTO-REGISTRATION =====================
bool registerSensor() {
  if (WiFi.status() != WL_CONNECTED) {
    s2println("[Register] Error: WiFi not connected.");
    return false;
  }

  String url = String(SERVER_BASE_URL) + "/api/v1/sensors/register";
  s2println("\n[Register] Registering sensor \"" + String(SENSOR_ID) + "\" with platform...");

  HTTPClient http;
  if (!beginRequest(http, url)) {
    s2println("[Register] Failed to initialize HTTP client.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  String payload = String("{") +
    "\"sensorId\":\"" + SENSOR_ID + "\"," +
    "\"sensorVersion\":\"" + savedCfgVersion + "\"," +
    "\"firmwareVersion\":\"" + FIRMWARE_VERSION + "\"," +
    "\"hardwareModel\":\"" + HARDWARE_MODEL + "\"" +
  "}";

  uint32_t t0 = millis();
  int code = http.POST(payload);
  uint32_t elapsed = millis() - t0;
  String body = http.getString();
  http.end();

  s2printf("[Register] HTTP %d (%lu ms)\r\n", code, (unsigned long)elapsed);

  if (code == 200 || code == 201) {
    String token = extractJsonString(body, "token");
    if (token.length() > 0) {
      saveSensorPrefs(token, SENSOR_ID, savedCfgVersion);
      s2println("[Register] Success! Bearer token saved to NVS.");
      return true;
    }
    s2println("[Register] Warning: 200/201 response did not contain a token: " + body);
    return false;
  }

  s2println("[Register] Failed: " + body);
  return false;
}

// ======================= OPTION 1: HEARTBEAT ======================
void sendHeartbeat(bool silent) {
  if (savedToken.length() == 0) {
    s2println("[Heartbeat] No token found. Attempting auto-registration first...");
    if (!registerSensor()) return;
  }

  String url = String(SERVER_BASE_URL) + "/api/v1/sensors/heartbeat";
  if (!silent) {
    s2println("\n[1] Sending Heartbeat...");
  }

  HTTPClient http;
  if (!beginRequest(http, url)) {
    s2println("[Heartbeat] Failed to begin HTTP request.");
    return;
  }

  addAuthHeaders(http);
  http.addHeader("Content-Type", "application/json");

  uint32_t uptimeSec = millis() / 1000UL;
  uint32_t freeHeap  = ESP.getFreeHeap();
  int      rssi      = WiFi.RSSI();

  String payload = String("{") +
    "\"sensorId\":\"" + SENSOR_ID + "\"," +
    "\"sensorVersion\":\"" + savedCfgVersion + "\"," +
    "\"firmwareVersion\":\"" + FIRMWARE_VERSION + "\"," +
    "\"hardwareModel\":\"" + HARDWARE_MODEL + "\"," +
    "\"metadata\":{" +
      "\"freeHeap\":" + String(freeHeap) + "," +
      "\"rssi\":" + String(rssi) + "," +
      "\"uptimeSec\":" + String(uptimeSec) +
    "}" +
  "}";

  uint32_t t0 = millis();
  int code = http.POST(payload);
  uint32_t elapsed = millis() - t0;
  String body = http.getString();
  http.end();

  if (!silent) {
    s2printf("[Heartbeat] HTTP %d (%lu ms)\r\n", code, (unsigned long)elapsed);
  }

  if (code == 200) {
    if (!silent) {
      String sensorStatus = extractJsonString(body, "sensorStatus");
      String serverTime   = extractJsonString(body, "serverTime");
      s2println("[Heartbeat] Status: OK | Sensor Status: " + sensorStatus + " | Server Time: " + serverTime);
    }
  } else if (code == 401) {
    s2println("[Heartbeat] Token rejected (401). Re-registering automatically...");
    clearSensorPrefs();
    registerSensor();
  } else {
    s2println("[Heartbeat] Error response: " + body);
  }
}

// ======================= OPTION 2: UPLOAD DATA (MAX 5MB) ==========
void uploadData() {
  if (savedToken.length() == 0) {
    s2println("[Upload] No token found. Attempting auto-registration first...");
    if (!registerSensor()) return;
  }

  s2println("\n[2] Upload Data (Max 5 MB per file)");
  s2println("  Send file bytes over UART2 RX now (waiting 5 seconds for first byte...");
  s2println("  or wait 5 seconds to send an automatic telemetry CSV sample):");

  clearUart2Rx();

  const char* tempPath = "/upload_tmp.dat";
  if (SPIFFS.exists(tempPath)) {
    SPIFFS.remove(tempPath);
  }

  File upFile = SPIFFS.open(tempPath, FILE_WRITE);
  if (!upFile) {
    s2println("[Upload] Failed to open temporary file in SPIFFS.");
    return;
  }

  size_t totalBytes = 0;
  bool   receivedExternalData = false;
  bool   exceededLimit = false;

  uint32_t waitStart = millis();
  while ((millis() - waitStart) < UPLOAD_IDLE_WAIT_MS) {
    if (Serial2.available()) {
      receivedExternalData = true;
      break;
    }
    delay(10);
  }

  String uploadFileName = "";
  String uploadMimeType = "text/csv";

  if (receivedExternalData) {
    s2println("  [UART2 RX] Receiving data stream...");
    uint32_t lastByteAt = millis();
    uint8_t buf[512];

    while ((millis() - lastByteAt) < 1500) { // 1.5s inter-chunk idle timeout
      int avail = Serial2.available();
      if (avail > 0) {
        int toRead = (avail > (int)sizeof(buf)) ? (int)sizeof(buf) : avail;
        int bytesRead = Serial2.readBytes(buf, toRead);
        if (bytesRead > 0) {
          if (totalBytes + (size_t)bytesRead > MAX_FILE_BYTES) {
            exceededLimit = true;
            break;
          }
          upFile.write(buf, bytesRead);
          totalBytes += (size_t)bytesRead;
          lastByteAt = millis();
        }
      } else {
        delay(5);
      }
    }
    uploadFileName = String(SENSOR_ID) + "_uart2_" + String(millis() / 1000UL) + ".csv";
  } else {
    // Generate sample telemetry CSV
    s2println("  [Upload] No UART2 stream detected within 5s — generating sample telemetry CSV...");
    String csv = "timestamp_ms,sensor_id,config_version,firmware_version,rssi_dbm,free_heap_bytes\n";
    csv += String(millis()) + "," + SENSOR_ID + "," + savedCfgVersion + "," + FIRMWARE_VERSION + "," + String(WiFi.RSSI()) + "," + String(ESP.getFreeHeap()) + "\n";
    upFile.print(csv);
    totalBytes = csv.length();
    uploadFileName = String(SENSOR_ID) + "_telemetry_" + String(millis() / 1000UL) + ".csv";
  }

  upFile.close();

  if (exceededLimit) {
    SPIFFS.remove(tempPath);
    s2println("[Upload] ERROR: File exceeds the 5 MB maximum size limit. Upload aborted.");
    return;
  }

  if (totalBytes == 0) {
    SPIFFS.remove(tempPath);
    s2println("[Upload] ERROR: File is empty (0 bytes). Upload aborted.");
    return;
  }

  // Read payload to build multipart/form-data body
  File readBack = SPIFFS.open(tempPath, FILE_READ);
  if (!readBack) {
    s2println("[Upload] ERROR: Could not read buffered upload file.");
    return;
  }
  String fileContent = readBack.readString();
  readBack.close();
  SPIFFS.remove(tempPath);

  String boundary = "----ESP32FileVaultBoundary" + String(millis());
  String head = "";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"deviceId\"\r\n\r\n";
  head += String(SENSOR_ID) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"file\"; filename=\"" + uploadFileName + "\"\r\n";
  head += "Content-Type: " + uploadMimeType + "\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";
  String multipartBody = head + fileContent + tail;

  String url = String(SERVER_BASE_URL) + "/api/v1/sensors/upload";
  HTTPClient http;
  if (!beginRequest(http, url)) {
    s2println("[Upload] Failed to initialize HTTP request.");
    return;
  }

  addAuthHeaders(http);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  s2printf("  [Upload] Uploading \"%s\" (%u bytes)...\r\n", uploadFileName.c_str(), (unsigned int)totalBytes);
  uint32_t t0 = millis();
  int code = http.POST((uint8_t*)multipartBody.c_str(), multipartBody.length());
  uint32_t elapsed = millis() - t0;
  String resp = http.getString();
  http.end();

  s2printf("[Upload] HTTP %d (%lu ms)\r\n", code, (unsigned long)elapsed);

  if (code == 200 || code == 201) {
    String uploadId = extractJsonString(resp, "uploadId");
    s2println("[Upload] Success! Upload ID: " + uploadId);
  } else if (code == 401) {
    s2println("[Upload] Unauthorized (401). Clearing token and re-registering...");
    clearSensorPrefs();
    registerSensor();
  } else if (code == 403) {
    s2println("[Upload] Rejected (403): Sensor is currently DEACTIVATED by administrator.");
  } else {
    s2println("[Upload] Failed: " + resp);
  }
}

// ======================= OPTION 3: VERSION CHECK & AUTO-DOWNLOAD ==
bool downloadConfig(const String& expectedVersion) {
  String url = String(SERVER_BASE_URL) + "/api/v1/sensors/configuration/download";
  s2println("  [Config] Downloading active configuration from server...");

  HTTPClient http;
  if (!beginRequest(http, url)) {
    s2println("  [Config] Failed to initialize HTTP request.");
    return false;
  }

  addAuthHeaders(http);
  const char* headerKeys[] = { "X-Config-Version", "X-Config-Checksum" };
  http.collectHeaders(headerKeys, 2);

  uint32_t t0 = millis();
  int code = http.GET();
  uint32_t elapsed = millis() - t0;
  String configPayload = http.getString();
  String headerVersion = http.header("X-Config-Version");
  http.end();

  s2printf("  [Config] HTTP %d (%lu ms, %u bytes)\r\n",
           code,
           (unsigned long)elapsed,
           (unsigned int)configPayload.length());

  if (code != 200) {
    s2println("  [Config] Download failed: " + configPayload);
    return false;
  }

  String newVersion = (headerVersion.length() > 0) ? headerVersion : expectedVersion;

  // 1. Save to SPIFFS /config.json
  File cfgFile = SPIFFS.open("/config.json", FILE_WRITE);
  if (cfgFile) {
    cfgFile.print(configPayload);
    cfgFile.close();
    s2println("  [Config] Saved to SPIFFS: /config.json");
  } else {
    s2println("  [Config] Warning: Could not write /config.json to SPIFFS.");
  }

  // 2. Output raw config between markers on UART2 TX for PC folder capture
  s2println("  [Config] Streaming configuration over UART2 TX between markers:");
  s2println("<<<CONFIG_START>>>");
  Serial2.print(configPayload);
  if (!configPayload.endsWith("\n")) {
    Serial2.println();
  }
  s2println("<<<CONFIG_END>>>");

  // 3. Update sensor's stored configuration version in NVS
  if (newVersion.length() > 0) {
    saveSensorPrefs(savedToken, SENSOR_ID, newVersion);
    s2println("  [Config] Updated NVS sensor config version -> " + savedCfgVersion);

    // 4. Sync updated version to the admin panel immediately via silent heartbeat
    sendHeartbeat(true);
    s2println("  [Config] Synced updated sensor version (" + savedCfgVersion + ") with server.");
  }

  return true;
}

void checkVersion() {
  if (savedToken.length() == 0) {
    s2println("[VersionCheck] No token found. Attempting auto-registration first...");
    if (!registerSensor()) return;
  }

  String url = String(SERVER_BASE_URL) + "/api/v1/sensors/version-check";
  s2println("\n[3] Checking Configuration Version (Current: " + savedCfgVersion + ")...");

  HTTPClient http;
  if (!beginRequest(http, url)) {
    s2println("[VersionCheck] Failed to initialize HTTP request.");
    return;
  }

  addAuthHeaders(http);
  http.addHeader("Content-Type", "application/json");

  String payload = String("{") +
    "\"sensorId\":\"" + SENSOR_ID + "\"," +
    "\"currentConfigVersion\":\"" + savedCfgVersion + "\"" +
  "}";

  uint32_t t0 = millis();
  int code = http.POST(payload);
  uint32_t elapsed = millis() - t0;
  String body = http.getString();
  http.end();

  s2printf("[VersionCheck] HTTP %d (%lu ms)\r\n", code, (unsigned long)elapsed);

  if (code == 401) {
    s2println("[VersionCheck] Token rejected (401). Re-registering automatically...");
    clearSensorPrefs();
    registerSensor();
    return;
  }

  String result        = extractJsonString(body, "result");
  String activeVersion = extractJsonString(body, "activeConfigVersion");
  String isUpdateStr   = extractJsonString(body, "isUpdateAvailable");
  String message       = extractJsonString(body, "message");

  s2println("  Result        : " + (result.length() ? result : "UNKNOWN"));
  s2println("  Local Version : " + savedCfgVersion);
  s2println("  Server Version: " + (activeVersion.length() ? activeVersion : "None"));
  if (message.length() > 0) {
    s2println("  Message       : " + message);
  }

  if (result == "UPDATE_AVAILABLE" || isUpdateStr == "true") {
    s2println("  [!] New configuration update available (" + activeVersion + ")! Auto-downloading...");
    downloadConfig(activeVersion);
  } else if (result == "CURRENT") {
    s2println("  [OK] Sensor configuration is already up to date.");
  } else if (result == "SENSOR_DEACTIVATED") {
    s2println("  [!] Sensor is currently DEACTIVATED by administrator.");
  } else if (result == "NO_CONFIGURATION_AVAILABLE") {
    s2println("  [i] No active global configuration deployed on server yet.");
  }
}

// ======================= OPTION 4: RE-REGISTRATION ================
void reRegister() {
  s2println("\n[4] Re-registering Sensor...");
  clearSensorPrefs();
  s2println("  Cleared saved token and reset config version to 0.0.0.");
  registerSensor();
}

// ======================= MENU DISPLAY =============================
void printMenu() {
  s2println("\n====================================================");
  s2println("   FileVault ESP32 Sensor Menu (UART2)");
  s2println("----------------------------------------------------");
  s2println("   Sensor ID      : " + String(SENSOR_ID));
  s2println("   Config Version : " + savedCfgVersion);
  s2println("   Auth Token     : " + String(savedToken.length() > 0 ? "Issued (Active)" : "Missing"));
  s2println("   WiFi           : " + WiFi.SSID() + " (" + WiFi.localIP().toString() + ")");
  s2println("----------------------------------------------------");
  s2println("   [1] Heartbeat");
  s2println("   [2] Upload Data (max 5 MB per file)");
  s2println("   [3] Check Version (auto-downloads & updates config)");
  s2println("   [4] Re-registration");
  s2println("====================================================");
  s2print("Select option (1-4): ");
}

// ======================= ARDUINO SETUP & LOOP =====================
void setup() {
  // Initialize ONLY UART2 (GPIO 16 RX2, GPIO 17 TX2)
  Serial2.begin(UART2_BAUD, SERIAL_8N1, UART2_RX_PIN, UART2_TX_PIN);
  delay(300);

  s2println("\n\n====================================================");
  s2println("   ESP32 Sensor Platform Client v4.1");
  s2println("   UART2  : GPIO 16 (RX2) / GPIO 17 (TX2) @ 115200");
  s2println("   Server : " + String(SERVER_BASE_URL));
  s2println("====================================================");

  if (!SPIFFS.begin(true)) {
    s2println("[SPIFFS] Error mounting SPIFFS!");
  } else {
    s2println("[SPIFFS] Mounted ready.");
  }

  // Phase 0: Provision / Auto-connect WiFi
  setupWiFi();

  // Phase 1: Load NVS sensor credentials & auto-register if needed
  loadSensorPrefs();
  if (savedToken.length() == 0) {
    s2println("[Setup] No valid token in NVS for " + String(SENSOR_ID) + ". Running auto-registration...");
    registerSensor();
  } else {
    s2println("[Setup] Loaded token from NVS for " + savedSensorId + " (Config v" + savedCfgVersion + ").");
    // Send initial silent heartbeat so dashboard marks sensor online immediately
    sendHeartbeat(true);
  }

  // Phase 2: Show 4-option interactive menu
  clearUart2Rx();
  printMenu();
}

void loop() {
  // Guard: automatically reconnect if WiFi drops
  if (WiFi.status() != WL_CONNECTED) {
    s2println("\n[WiFi] Connection lost! Reconnecting...");
    setupWiFi();
    printMenu();
  }

  if (Serial2.available()) {
    String input = readLineFromUart2();
    if (input.length() == 0) return;

    s2println(input);

    if (input == "1") {
      sendHeartbeat(false);
    } else if (input == "2") {
      uploadData();
    } else if (input == "3") {
      checkVersion();
    } else if (input == "4") {
      reRegister();
    } else {
      s2println("[!] Invalid option \"" + input + "\". Please enter 1, 2, 3, or 4.");
    }

    clearUart2Rx();
    printMenu();
  }

  delay(10);
}
