# Sensor Platform (FileVault / DeviceVault v3)

**Sensor Platform** is a production-ready, full-stack Next.js application for sensor identity, telemetry intake, global configuration management, and file upload logging with a comprehensive administrative dashboard.

---

## Overview

The platform supports two primary client surfaces and an administrative interface:

1. **Sensor-Facing API v1** (`/api/v1/sensors/*`)
   - **Auto-Registration** (`POST /api/v1/sensors/register`): sensors autonomously register without admin approval, receiving a bearer token once.
   - **Heartbeat & Telemetry** (`POST /api/v1/sensors/heartbeat`): sensors report telemetry metadata and ping the platform.
   - **Version Check** (`POST /api/v1/sensors/version-check`): sensors query whether their installed configuration matches the active global configuration.
   - **Configuration Download** (`GET /api/v1/sensors/configuration/download`): sensors securely stream the active global configuration payload. Every download is logged to an immutable event audit trail.
   - **Data Upload** (`POST /api/v1/sensors/upload`): registered sensors submit telemetry and data files with progress tracking.

2. **Admin Dashboard** (`/admin`)
   - Protected by HTTP-only JWT sessions and database authorization checks.
   - Centralized controls for sensors, global configuration publishing, registration history, daily version check telemetry metrics, and immutable audit logs.

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
| Storage | Local filesystem driver (abstracted for S3/R2/MinIO) |

---

## Admin Navigation

The admin shell provides 8 primary navigation tabs:

1. **Overview** (`/admin/dashboard`): sensor fleet statistics, file storage metrics, and 7-day upload activity charts.
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
    "sensorId": "SENSOR-WAREHOUSE-01",
    "sensorVersion": "1.0.0",
    "firmwareVersion": "2.4.1",
    "hardwareModel": "ESP32-S3",
    "metadata": { "battery": 98, "rssi": -65 }
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
    "message": "Your configuration is up to date."
  }
  ```
- **Response (200 OK — Update Available):**
  ```json
  {
    "result": "UPDATE_AVAILABLE",
    "activeConfigVersion": "1.2.0",
    "message": "A newer configuration version (1.2.0) is available."
  }
  ```

### 4. Configuration Download

- **Endpoint:** `GET /api/v1/sensors/configuration/download`
- **Headers:** `Authorization: Bearer <sensor-token>`
- **Response:** Raw binary file stream with `Content-Disposition`, `Content-Type`, and `X-Config-Version` headers. Every download writes an immutable record to `fv_sensor_config_download_events`.

### 5. Data Upload

- **Endpoint:** `POST /api/v1/sensors/upload`
- **Headers:** `Authorization: Bearer <sensor-token>` (or `deviceId` in multipart form)
- **Body:** `multipart/form-data` with `file` and optional `deviceId`
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
3. **Autonomous Sensor Sync:** Sensors query `POST /api/v1/sensors/version-check`. When receiving `UPDATE_AVAILABLE`, they stream the new configuration from `GET /api/v1/sensors/configuration/download`.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ADMIN_USERNAME` | Yes | `admin` | Default admin username |
| `ADMIN_PASSWORD` | Yes | — | Default admin password |
| `SESSION_SECRET` | Yes | — | Secret string (min 32 chars) for signing admin cookies |
| `UPLOAD_STORAGE_PROVIDER` | No | `local` | Storage driver (`local`) |
| `UPLOAD_DIR` | No | `./storage/uploads` | Path for stored data files and configs |
| `MAX_FILE_SIZE_MB` | No | `100` | Max upload size in megabytes |
| `SENSOR_TOKEN_SECRET` | No | (default) | Reserved for HMAC token signing |

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
# Executes all unit test suites (33 tests)
node --import tsx --test tests/*.test.ts
```

### 3. Run Development Server

```bash
npx next dev -p 3000
```
