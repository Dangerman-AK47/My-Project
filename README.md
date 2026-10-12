# Sensor Platform (FileVault / DeviceVault v3)

**Sensor Platform** is a production-ready, full-stack Next.js application for sensor identity, telemetry intake, global configuration management, and file upload logging with a comprehensive administrative dashboard.

---

## Overview

The platform supports two primary client surfaces and an administrative interface:

1. **Sensor-Facing API v1** (`/api/v1/sensors/*`)
   - **Auto-Registration** (`POST /api/v1/sensors/register`): sensors autonomously register without admin approval, receiving a bearer token once.
   - **Heartbeat & Telemetry** (`POST /api/v1/sensors/heartbeat`): sensors report telemetry metadata and ping the platform.
   - **Version Check** (`POST /api/v1/sensors/version-check`): sensors query whether their installed configuration matches the active global configuration. If an update is available, the config file is downloaded **automatically**.
   - **Configuration Download** (`GET /api/v1/sensors/configuration/download`): sensors securely stream the active global configuration payload. Every download is logged to an immutable event audit trail.
   - **Data Upload** (`POST /api/v1/sensors/upload`): registered sensors submit telemetry and data files (max **5 MB** per file).

2. **Admin Dashboard** (`/admin`)
   - Protected by HTTP-only JWT sessions and database authorization checks.
   - Centralized controls for sensors, global configuration publishing, registration history, daily version check telemetry metrics, and immutable audit logs.
   - All pages **auto-refresh every 30 seconds** — no manual reload required.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma |
| Admin Auth | HTTP-only JWT sessions (`jose`) |
| Sensor Auth | CSPRNG Bearer tokens with `bcryptjs` hashing (cost 12) |
| Validation | Zod (strict semver validation + forward-only checks) |
| Storage | Database BYTEA driver (abstracted for local / S3 / R2) |

---

## ESP32 Firmware — Behaviour

The Arduino sketch (`sensor_platform_client.ino`) uses **UART2 (Serial2, GPIO 16 RX2 / GPIO 17 TX2) for ALL user interaction**. UART0 (USB) is used **only** for firmware flashing via Arduino IDE.

### Physical Connection
Connect a **USB-to-Serial adapter** (CP2102 / CH340 / FTDI) between your PC and the ESP32:
```
PC USB → [USB-to-Serial Adapter] TX → GPIO 16 (RX2) on ESP32
                                  RX ← GPIO 17 (TX2) on ESP32
                                  GND ← GND on ESP32
```
Open a serial terminal (PuTTY, Tera Term, etc.) on the adapter's COM port at **115200 baud** to interact.

### 1. WiFi Provisioning (via UART2)
- On boot, checks NVS for saved WiFi credentials.
- **Credentials exist** → tries each saved network automatically (30s per network). On success, proceeds.
- **No credentials / all fail** → scans networks, **prints numbered list on UART2 TX**. User types number then password via **UART2 RX**. On success, credentials saved to NVS.
- Up to **5 networks** stored; tried automatically on every subsequent boot.

### 2. Auto-Registration
- After WiFi connects, checks NVS for saved `{ sensorId, token }`.
- **Match AND token exists** → skip registration, show menu on UART2 TX.
- **`SENSOR_ID` changed in code** → clear old token, auto-register as new ID, save to NVS.

### 3. Interactive Menu (via UART2)

All menu output is on **UART2 TX (GPIO 17)**. All user input is read from **UART2 RX (GPIO 16)**.

```
[1] Send Heartbeat / Ping
[2] Upload Data File        (max 5 MB per file)
[3] Check Version
[4] Re-Register
```

- **[3] Check Version** — if update available, config downloads **automatically**, saved to SPIFFS (`/config.json`), and raw bytes are output on **UART2 TX** between `<<<CONFIG_START>>>` / `<<<CONFIG_END>>>` markers for PC capture.
- **[2] Upload** — files > 5 MB rejected on ESP32 before sending.

---

## Admin Navigation

The admin shell provides 8 primary navigation tabs:

1. **Overview** (`/admin/dashboard`): sensor fleet statistics, file storage metrics, and 7-day upload activity charts. Auto-refreshes every 30 seconds.
2. **Sensors** (`/admin/sensors`): search, filter, and view registered sensors with active/deactive controls, token status, and permanent deletion with confirmation.
   - **Sensor Detail** (`/admin/sensors/[id]`): telemetry data, token revocation, permanent deletion, and historical event logs.
3. **Configuration Settings** (`/admin/configs`): upload, forward-version validate, and activate global configurations distributed across all sensors.
4. **Registration History** (`/admin/history`): read-only log of automatically and manually registered sensors with timestamps and status badges.
5. **Uploaded Files** (`/admin/files`): inspect, search, download, and delete data files submitted by sensors.
6. **Version Check Metrics** (`/admin/version-check-metrics`): daily telemetry breakdown of active vs. deactive sensors checking in, unique sensor counts, and result trends with date range filtering.
7. **Audit Logs** (`/admin/audit`): security audit trail of all administrator actions (config activations, status modifications, sensor deletions).
8. **Upload Data** (`/upload`): web upload interface for data files.

---

## Sensor API v1 Reference

All sensor endpoints run under `/api/v1/sensors/*`.

### 1. Sensor Registration

- **Endpoint:** `POST /api/v1/sensors/register`
- **Auth:** None (Public intake)
- **Request Body:**
  ```json
  {
    "sensorId": "SENSOR-WAREHOUSE-01"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "sensorId": "SENSOR-WAREHOUSE-01",
    "token": "4f8a9e2b1c...",
    "status": "ACTIVE",
    "message": "Sensor registered successfully. Store this token securely; it will not be shown again."
  }
  ```

### 2. Heartbeat & Telemetry

- **Endpoint:** `POST /api/v1/sensors/heartbeat`
- **Headers:** `Authorization: Bearer <sensor-token>`
- **Request Body:**
  ```json
  {
    "sensorVersion": "1.0.0",
    "firmwareVersion": "2.4.1",
    "hardwareModel": "ESP32-DevKit-V1",
    "metadata": { "freeHeap": 234000, "rssi": -65, "uptime": 3600 }
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "serverTime": "2026-09-22T14:45:00.000Z",
    "sensorStatus": "ACTIVE"
  }
  ```

### 3. Version Check

- **Endpoint:** `POST /api/v1/sensors/version-check`
- **Headers:** `Authorization: Bearer <sensor-token>`
- **Request Body:**
  ```json
  {
    "currentConfigVersion": "1.0.0"
  }
  ```
- **Response (200 OK — Up to Date):**
  ```json
  {
    "result": "CURRENT",
    "activeConfigVersion": "1.0.0",
    "isUpdateAvailable": false,
    "message": "Your configuration is up to date."
  }
  ```
- **Response (200 OK — Update Available):**
  ```json
  {
    "result": "UPDATE_AVAILABLE",
    "activeConfigVersion": "1.2.0",
    "isUpdateAvailable": true,
    "message": "A newer configuration version (1.2.0) is available."
  }
  ```

### 4. Configuration Download

- **Endpoint:** `GET /api/v1/sensors/configuration/download`
- **Headers:** `Authorization: Bearer <sensor-token>`
- **Response:** Raw binary file stream with `Content-Disposition`, `Content-Type`, and `X-Config-Version` headers. Every download writes an immutable record to `fv_sensor_config_download_events`.

### 5. Data Upload

- **Endpoint:** `POST /api/v1/sensors/upload`
- **Headers:** `Authorization: Bearer <sensor-token>`
- **Body:** `multipart/form-data` with `file` field (max **5 MB**)
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "uploadId": "UP-000001",
      "deviceId": "SENSOR-WAREHOUSE-01",
      "originalFileName": "telemetry.csv",
      "fileSizeBytes": 18432,
      "uploadedAt": "2026-09-22T14:45:00.000Z"
    }
  }
  ```

---

## Global Configuration Management Workflow

1. **Publish Configuration:** Admin visits `/admin/configs` and uploads a configuration file, specifying a strictly higher semver string (e.g., `1.1.0` if `1.0.0` is active). Versions lower than or equal to the active version are rejected.
2. **Activate:** Admin clicks **Activate**. In an atomic transaction, the previous active configuration is marked `ARCHIVED`, and the target becomes `ACTIVE`. A PostgreSQL partial unique index ensures only one global configuration is active at any time.
3. **Autonomous Sensor Sync:** Sensors select **[3] Check Version** from the menu. When the server returns `UPDATE_AVAILABLE`, the ESP32 immediately downloads the new configuration from `GET /api/v1/sensors/configuration/download`, saves it to SPIFFS, and updates its version in NVS.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (pooler, port 6543) |
| `DIRECT_URL` | Yes | — | Direct PostgreSQL connection string (for migrations) |
| `ADMIN_USERNAME` | Yes | `admin` | Default admin username |
| `ADMIN_PASSWORD` | Yes | — | Default admin password |
| `SESSION_SECRET` | Yes | — | Secret string (min 32 chars) for signing admin cookies |
| `UPLOAD_STORAGE_PROVIDER` | No | `database` | Storage driver (`database`, `local`, `supabase`) |
| `MAX_FILE_SIZE_MB` | No | `5` | Max upload size in megabytes (ESP32 enforces this too) |

---

## Running Locally

### 1. Database Setup & Seed

```bash
# Apply migrations
npx prisma migrate dev

# Seed initial admin and test sensors
node --import tsx prisma/seed.ts
```

### 2. Run Test Suite

```bash
node --import tsx --test tests/*.test.ts
```

### 3. Run Development Server

```bash
npx next dev -p 3000
```

Open: `http://localhost:3000/admin/login`
Login: username `admin` / password `admin123`
