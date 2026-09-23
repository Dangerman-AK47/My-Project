# Specification: Sensor Platform v3 — Global Config, API v1, Auto-Register

## Status

DRAFT — AWAITING USER APPROVAL

## RnA Reference

- `./rna.md`

---

## Problem Statement

The v2 implementation uses a **per-sensor configuration model** — each sensor has its own stack of config versions. The new business requirement is a **single global configuration** shared by all sensors simultaneously. Additionally, sensor registration is now fully automatic (no admin involvement) via a dedicated `POST /api/v1/sensors/register` endpoint that issues a token in the response. All sensor-facing APIs must be versioned under `/api/v1/sensors/*`. A heartbeat endpoint, config download event tracking, permanent sensor deletion, and revised metrics are also required.

## Goal

When this task is complete:
- All sensor-facing endpoints are at `/api/v1/sensors/*`.
- A single global configuration (not per-sensor) is managed by the admin.
- Sensors register themselves via `POST /api/v1/sensors/register`, receiving a token once.
- Sensors call heartbeat, version-check, upload, and config-download using their token.
- Config downloads are logged to `fv_sensor_config_download_events`.
- Admins can permanently delete sensors with a confirmation dialog.
- Registration history is read-only (no approve/reject UI).
- Version-check metrics page shows ACTIVE/DEACTIVE sensor counts and unique sensor counts per day.

## Background

The v2 application was completed with per-sensor configs and admin-issued tokens. The revised business model treats all sensors identically — they share one "firmware/config" version. Token issuance is automatic, removing the admin overhead of approving each sensor.

---

## Scope

### In Scope

- Replace per-sensor `SensorConfiguration` model with `GlobalSensorConfiguration` (no sensor FK).
- Replace per-sensor `SensorConfigStorageObject` with `GlobalConfigStorageObject`.
- New `SensorConfigDownloadEvent` model (`fv_sensor_config_download_events`).
- New sensor endpoints: `POST /api/v1/sensors/register`, `POST /api/v1/sensors/heartbeat`.
- Move existing sensor endpoints to `/api/v1/sensors/*` path prefix.
- Remove auto-register-on-upload (`AUTO_REGISTER_ON_UPLOAD` env var removed or deprecated).
- Remove admin token-issue endpoint (`POST /api/admin/sensors/[id]/token`).
- Keep admin token-revoke endpoint (`DELETE /api/admin/sensors/[id]/token`).
- New `DELETE /api/admin/sensors/[id]` — permanent deletion with token revocation.
- Remove approve/reject routes from registration history.
- New global config admin API: `GET/POST /api/admin/configuration`, `POST /api/admin/configuration/[id]/activate`.
- Update `/admin/configs` (Configuration Settings) to show global config history.
- Update `/admin/history` to read-only.
- Rename `/admin/metrics` to `/admin/version-check-metrics`.
- Revised metrics: ACTIVE vs DEACTIVE count per day + unique sensor counts + date range filter.
- Config upload must reject versions ≤ current ACTIVE config version (semver forward-only).

### Out of Scope

- Multi-admin roles.
- Cloud storage (S3/R2).
- Real-time push (WebSockets/SSE).
- Config content validation (JSON schema).
- Email/webhook notifications.
- Production deployment infrastructure.

---

## Actors

| Actor | Description |
|-------|-------------|
| **Admin** | Human operator logged into the admin dashboard. Manages the global config, reviews registration history, monitors metrics, can revoke tokens and delete sensors. |
| **Sensor** | Embedded device. Calls register once, then uses bearer token for heartbeat, version-check, upload, and config-download. |

---

## User Stories

1. As a **sensor**, I want to register via a single API call and receive my token so I can authenticate all subsequent calls.
2. As a **sensor**, I want to call a heartbeat endpoint to report my status and receive a `200 OK` confirmation.
3. As a **sensor**, I want to download the global active configuration file so I can update my running config.
4. As an **admin**, I want to upload and activate a global configuration so it applies to all sensors simultaneously.
5. As an **admin**, I want to see which sensors are on the current config version vs. an older version via the version-check metrics.
6. As an **admin**, I want to permanently delete a sensor (with confirmation) so I can clean up decommissioned sensors.
7. As an **admin**, I want to revoke a sensor's token so I can block unauthorized devices.
8. As an **admin**, I want to view registration history (read-only) to audit when sensors registered.

---

## Functional Requirements

### FR-001 — Sensor Auto-Registration Endpoint

`POST /api/v1/sensors/register` (unauthenticated, public).

**Request body:** `{ "sensorId": "string" }` — must pass existing deviceId validation schema.

**Behavior:**
1. Validate `sensorId` format.
2. Check if `RegisteredDevice` with this `deviceId` exists → if yes, return `409 { status: "already_registered" }`.
3. In a single transaction:
   - Create `RegisteredDevice` (status `ACTIVE`).
   - Create `DeviceRegistrationRequest` (status `AUTO_APPROVED`).
   - Generate 32-byte CSPRNG hex token.
   - Store bcrypt hash (cost 12) in `RegisteredDevice.tokenHash`.
   - Write `AdminAuditEvent` with action `SENSOR_REGISTERED` (adminId = null, sensor-triggered).
4. Return `{ "token": "<plain-text-token>", "sensorId": "<sensorId>" }` — token shown **once**.

**Acceptance criteria:**
- Given a new `sensorId`, when called, then `RegisteredDevice` + `DeviceRegistrationRequest[AUTO_APPROVED]` are created and token is returned.
- Given an existing `sensorId`, when called, then `409 already_registered` is returned; no new rows created.
- Given `sensorId` failing format validation, then `400 validation_error`.
- The plain-text token is in the response but not stored in the DB (only `tokenHash` stored).

---

### FR-002 — Sensor Heartbeat Endpoint

`POST /api/v1/sensors/heartbeat` (bearer-authed).

**Request body:** `{ "sensorId": "string", "sensorVersion"?: string, "firmwareVersion"?: string, "hardwareModel"?: string, "metadata"?: object }`.

**Behavior:**
- Authenticate with `requireSensorAuth()`.
- Cross-validate `sensorId` in body against authenticated device's `deviceId`.
- Update `RegisteredDevice`: `lastSeenAt = now()`, and any provided telemetry fields.
- Always return `200 { "status": "ok", "serverTime": "<ISO 8601>" }` — even if sensor is `DEACTIVE`.

**Acceptance criteria:**
- Given a valid token, when calling heartbeat, then `lastSeenAt` is updated and `200 ok` returned.
- Given a `DEACTIVE` sensor, when calling heartbeat, then `200 ok` is still returned (heartbeat is not blocked by status).
- Given mismatched `sensorId` and token, then `401 unauthorized`.

---

### FR-003 — Updated Upload Endpoint

`POST /api/v1/sensors/upload` (bearer-authed).

Same behavior as the old `POST /api/upload` **except:**
- No auto-registration. If sensor not found (or token is invalid), return `401 unauthorized`.
- Sensor must have registered first via `POST /api/v1/sensors/register`.
- `DEACTIVE` sensor returns `403 sensor_deactivated`.

**Acceptance criteria:**
- Given a valid token for an ACTIVE sensor, when uploading, then upload succeeds.
- Given an unregistered sensor (no token), then `401 unauthorized`.
- Given a `DEACTIVE` sensor, then `403 sensor_deactivated`.

> [!NOTE]
> The old `POST /api/upload` route is deleted. Any clients using the old path must be updated to `POST /api/v1/sensors/upload`.

---

### FR-004 — Updated Version-Check Endpoint

`POST /api/v1/sensors/version-check` (bearer-authed).

Same logic as v2 FR-004 **except:**
- The "active config" compared is the **global** active config (not per-sensor).
- Result logic is otherwise identical:
  1. Invalid bearer → `SENSOR_NOT_REGISTERED` (401).
  2. Invalid semver → `INVALID_VERSION` (400).
  3. Sensor DEACTIVE → `SENSOR_DEACTIVATED` (403).
  4. No global ACTIVE config → `NO_CONFIGURATION_AVAILABLE` (200).
  5. Versions match → `CURRENT` (200).
  6. Versions differ → `UPDATE_AVAILABLE` (200).

**Acceptance criteria:** Same as v2 FR-004, applied to the global config.

---

### FR-005 — Updated Config Download Endpoint

`GET /api/v1/sensors/configuration/download` (bearer-authed).

Same behavior as old `GET /api/sensor/config` **except:**
- Returns the global ACTIVE config (not per-sensor).
- Writes a `SensorConfigDownloadEvent` row on every successful download.

**Download event fields recorded:**
- `registeredDeviceId`, `deviceId`, `globalConfigId`, `configVersion` (snapshot), `ipAddress`, `userAgent`, `createdAt`.

**Acceptance criteria:**
- Given an ACTIVE sensor and a global ACTIVE config, when downloading, then raw config bytes are returned and a `SensorConfigDownloadEvent` row is written.
- Given no global ACTIVE config, then `404 no_configuration`.
- Given a DEACTIVE sensor, then `403 sensor_deactivated`.

---

### FR-006 — Global Config Upload (Admin)

`POST /api/admin/configuration` (multipart: `file` + `configVersion`).

Creates a `GlobalSensorConfiguration` with status `INACTIVE`.

**Validation:**
- `configVersion` must be a valid semver string.
- If a global ACTIVE config exists, the new `configVersion` must be **strictly greater** than the ACTIVE config's `configVersion` (semver `>` comparison). If not, return `409 version_not_forward`.
- File size must be ≤ `MAX_FILE_SIZE_MB`.
- If `configVersion` already exists (regardless of status) → `409 version_conflict`.

**Acceptance criteria:**
- Given `configVersion: "2.0.0"` when ACTIVE is `"1.5.0"`, then upload succeeds.
- Given `configVersion: "1.0.0"` when ACTIVE is `"1.5.0"`, then `409 version_not_forward`.
- Given `configVersion: "1.5.0"` (same as ACTIVE), then `409 version_not_forward`.
- Given non-semver `configVersion`, then `400 validation_error`.
- Given no ACTIVE config, any valid semver is accepted.

---

### FR-007 — Global Config Activation (Admin)

`POST /api/admin/configuration/[id]/activate`.

In a single transaction:
1. All existing `ACTIVE` global configs → `ARCHIVED`.
2. Target config → `ACTIVE`, set `activatedAt`, `activatedByAdminId`.
3. Write `AdminAuditEvent` with action `GLOBAL_CONFIG_ACTIVATED`.

DB-level enforcement: partial unique index ensures at most one ACTIVE row in `fv_global_sensor_configurations`.

**Acceptance criteria:**
- Given one ACTIVE config, when activating another, then old → `ARCHIVED`, new → `ACTIVE`.
- Given no ACTIVE config, when activating, then config becomes `ACTIVE`.
- Given already-ACTIVE config re-activated, operation is idempotent.

---

### FR-008 — Global Config List (Admin)

`GET /api/admin/configuration` — lists all `GlobalSensorConfiguration` records, newest first.

**Response fields per record:**
`id`, `configVersion`, `status`, `originalFileName`, `fileSizeBytes`, `checksum`, `uploadedByAdminId`, `activatedAt`, `createdAt`.

---

### FR-009 — Permanent Sensor Deletion (Admin)

`DELETE /api/admin/sensors/[id]`.

In a single transaction:
1. Set `RegisteredDevice.tokenHash = null` (revoke token).
2. Write `AdminAuditEvent` with action `SENSOR_DELETED`.
3. Delete `RegisteredDevice` row (cascades: `DeviceStatusEvent`, `SensorVersionCheckEvent` via `onDelete: SetNull` or `Cascade` per existing schema).

UI confirmation modal: shows `sensorId`, warns "This action is permanent and cannot be undone."

**Acceptance criteria:**
- Given an existing sensor, when admin confirms deletion, then `RegisteredDevice` is deleted and audit event written.
- Given a non-existent sensor ID, then `404 not_found`.
- Given a sensor with an active token, the token is invalidated before deletion.

---

### FR-010 — Admin Token Revoke (Kept from v2)

`DELETE /api/admin/sensors/[id]/token` (kept, renamed from v2's revoke).

Sets `RegisteredDevice.tokenHash = null`. Writes `AdminAuditEvent` with action `SENSOR_TOKEN_REVOKED`.

> [!IMPORTANT]
> `POST /api/admin/sensors/[id]/token` (token issuance by admin) is **removed** in v3. Tokens are only issued via `POST /api/v1/sensors/register`.

---

### FR-011 — Read-Only Registration History

`GET /api/admin/history` — unchanged (all statuses).

`POST /api/admin/history/[id]/approve` — **DELETED**.
`POST /api/admin/history/[id]/reject` — **DELETED**.

The history page UI removes approve/reject buttons. Status badges show `AUTO_APPROVED` for all v3-era registrations.

---

### FR-012 — Revised Version-Check Metrics

Admin page at `/admin/version-check-metrics` (new route, old `/admin/metrics` redirects here or is removed).

**API:** `GET /api/admin/version-check-metrics`

**Query params:** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 7 days).

**Response structure:**
```json
{
  "dateRange": { "from": "2026-09-15", "to": "2026-09-22" },
  "dailySummary": [
    {
      "date": "2026-09-22",
      "activeSensors": 12,
      "deactiveSensors": 3,
      "uniqueSensors": 15,
      "resultBreakdown": {
        "CURRENT": 10,
        "UPDATE_AVAILABLE": 5,
        "NO_CONFIGURATION_AVAILABLE": 0,
        "SENSOR_DEACTIVATED": 3,
        "INVALID_VERSION": 0,
        "SENSOR_NOT_REGISTERED": 0
      }
    }
  ]
}
```

Data sourced from `SensorVersionCheckEvent` joined with `RegisteredDevice.status` at time of query (current status, not historical status). `DailySensorVersionCheckMetric` may still be used for result breakdown counts; the active/deactive split comes from a live join.

**Acceptance criteria:**
- Given a date range, the page shows per-day rows within that range.
- Each row shows count of ACTIVE sensors that checked in, count of DEACTIVE sensors, and unique total.
- Given no events in range, empty state is shown.

---

### FR-013 — Sensor Detail Page (Updated)

The sensor detail page at `/admin/sensors/[id]` is updated:
- Removes the "per-sensor config" section entirely.
- Removes the "Issue Token" button (tokens are auto-issued on register).
- Adds a "Revoke Token" button (calls `DELETE /api/admin/sensors/[id]/token`).
- Adds a "Delete Sensor" button (opens confirmation modal, calls `DELETE /api/admin/sensors/[id]`).
- Telemetry fields (`firstSeenAt`, `lastSeenAt`, `sensorVersion`, `firmwareVersion`, `hardwareModel`) remain displayed.
- Upload history remains displayed.

---

### FR-014 — Configuration Settings Page (Updated)

`/admin/configs` (Configuration Settings) shows the **global** config list:
- Table of all `GlobalSensorConfiguration` records with status badges.
- "Upload Config" form (version + file).
- "Activate" button per inactive/archived config.
- Active config highlighted prominently.
- Shows version rejection message if uploaded version is not forward (≤ ACTIVE).

---

## Non-Functional Requirements

### Security

- Sensor tokens: 32-byte CSPRNG hex, bcrypt hash (cost 12), issued once on registration.
- Token plain text: returned only in `POST /api/v1/sensors/register` response. Never stored plain.
- `Authorization: Bearer <token>` header never logged; only first 8 chars for correlation.
- Config file storage paths use CSPRNG keys — not guessable.
- All sensor routes: `export const runtime = "nodejs"`.
- Permanent deletion is irreversible — confirmed in UI.

### Performance

- Version-check metrics query may join `SensorVersionCheckEvent` with `RegisteredDevice` — add `@@index([createdAt])` on the event table (already exists).
- Config download streaming (no full buffer in memory for large files).

### Reliability

- Registration is atomic (device + request + token hash in one transaction).
- Global config activation is atomic (archive all ACTIVE + set new ACTIVE + audit).
- Sensor deletion is atomic (revoke + audit + delete in one transaction).

### Compatibility

- Existing 26 unit tests must pass after changes.
- Old sensor API paths (`/api/sensor/*`, `/api/upload`) are deleted — not redirected. Clients must update.
- Admin API paths (`/api/admin/*`) are unchanged.

---

## Data Requirements

### Tables to Drop

| Old Table | Reason |
|-----------|--------|
| `fv_sensor_configurations` | Replaced by `fv_global_sensor_configurations` |
| `fv_sensor_config_storage_objects` | Replaced by `fv_global_config_storage_objects` |

### Tables to Create

#### `fv_global_sensor_configurations`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | |
| `configVersion` | `String` | Semver e.g. `"2.0.0"` |
| `status` | `ConfigurationStatus @default(INACTIVE)` | Reuses existing enum |
| `originalFileName` | `String` | |
| `storageKey` | `String` | StorageDriver key |
| `mimeType` | `String` | |
| `fileSizeBytes` | `Int` | |
| `checksum` | `String?` | SHA-256 |
| `uploadedByAdminId` | `String?` | FK → `AdminAccount`, SetNull on delete |
| `activatedByAdminId` | `String?` | FK → `AdminAccount`, SetNull on delete |
| `activatedAt` | `DateTime?` | |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |
| **Partial unique index** | `WHERE status = 'ACTIVE'` | At most one ACTIVE global config |
| **Unique index** | `configVersion` | No duplicate version strings |

#### `fv_global_config_storage_objects`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | |
| `globalConfigId` | `String` | FK → `GlobalSensorConfiguration`, Cascade delete |
| `storageProvider` | `String @default("local")` | |
| `storageKey` | `String` | |
| `createdAt` | `DateTime @default(now())` | |

#### `fv_sensor_config_download_events`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | |
| `registeredDeviceId` | `String?` | FK → `RegisteredDevice`, SetNull on delete |
| `deviceId` | `String` | Denormalized |
| `globalConfigId` | `String?` | FK → `GlobalSensorConfiguration`, SetNull on delete |
| `configVersion` | `String?` | Snapshot at download time |
| `ipAddress` | `String?` | |
| `userAgent` | `String?` | |
| `createdAt` | `DateTime @default(now())` | |

**Indexes on `fv_sensor_config_download_events`:** `[registeredDeviceId]`, `[deviceId]`, `[createdAt]`.

### Schema Changes to Existing Tables

#### `RegisteredDevice` — no schema changes needed

The `configurations` relation to `SensorConfiguration` is **removed**. The `versionChecks` relation to `SensorVersionCheckEvent` remains. The `configDownloads` relation to `SensorConfigDownloadEvent` is **added**.

#### `AdminAccount` — relations to per-sensor config removed, global config relations added

Remove `uploadedConfigs SensorConfiguration[] @relation("ConfigUploadedBy")` and `activatedConfigs SensorConfiguration[] @relation("ConfigActivatedBy")`. Add equivalent relations to `GlobalSensorConfiguration`.

---

## API Requirements

### New Sensor-Facing Routes (`/api/v1/sensors/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/sensors/register` | None | Register sensor, returns token once |
| `POST` | `/api/v1/sensors/heartbeat` | Bearer | Update telemetry |
| `POST` | `/api/v1/sensors/upload` | Bearer | Upload a data file |
| `POST` | `/api/v1/sensors/version-check` | Bearer | Check if config is current |
| `GET` | `/api/v1/sensors/configuration/download` | Bearer | Download global active config |

### Deleted Sensor Routes

| Deleted Path | Reason |
|-------------|--------|
| `POST /api/upload` | Replaced by `POST /api/v1/sensors/upload` |
| `POST /api/sensor/version-check` | Replaced by `POST /api/v1/sensors/version-check` |
| `GET /api/sensor/config` | Replaced by `GET /api/v1/sensors/configuration/download` |

### New/Updated Admin Routes

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/admin/configuration` | NEW — list global configs |
| `POST` | `/api/admin/configuration` | NEW — upload global config |
| `POST` | `/api/admin/configuration/[id]/activate` | NEW — activate global config |
| `DELETE` | `/api/admin/sensors/[id]` | NEW — permanent delete |
| `DELETE` | `/api/admin/sensors/[id]/token` | KEPT — revoke token |
| `GET` | `/api/admin/version-check-metrics` | NEW — revised metrics endpoint |

### Deleted Admin Routes

| Deleted Path | Reason |
|-------------|--------|
| `POST /api/admin/sensors/[id]/token` | Token issuance moved to auto-register |
| `POST /api/admin/history/[id]/approve` | Manual approval removed |
| `POST /api/admin/history/[id]/reject` | Manual rejection removed |
| `GET /api/admin/sensors/[id]/configs` | Per-sensor config replaced by global |
| `POST /api/admin/sensors/[id]/configs` | Per-sensor config replaced by global |
| `POST /api/admin/sensors/[id]/configs/[configId]/activate` | Per-sensor config replaced by global |
| `GET /api/admin/configs` | Replaced by `GET /api/admin/configuration` |
| `GET /api/admin/metrics` | Replaced by `GET /api/admin/version-check-metrics` |

### Response Schemas

#### `POST /api/v1/sensors/register` — 201
```json
{ "sensorId": "DEV-000001", "token": "a1b2c3...64hex" }
```

#### `POST /api/v1/sensors/heartbeat` — 200
```json
{ "status": "ok", "serverTime": "2026-09-22T15:00:00.000Z" }
```

#### `POST /api/v1/sensors/version-check` — 200
```json
{
  "result": "UPDATE_AVAILABLE",
  "activeConfigVersion": "2.0.0",
  "message": "A newer configuration is available."
}
```

#### `POST /api/admin/configuration` — 201
```json
{
  "id": "cuid",
  "configVersion": "2.0.0",
  "status": "INACTIVE",
  "originalFileName": "config.json",
  "fileSizeBytes": 2048,
  "createdAt": "2026-09-22T..."
}
```

---

## Error and Edge-Case Requirements

| Scenario | Expected Behavior |
|---------|------------------|
| Register with existing `sensorId` | `409 { status: "already_registered" }` |
| Register with invalid `sensorId` format | `400 { status: "validation_error" }` |
| Heartbeat with mismatched `sensorId` and token | `401 { status: "unauthorized" }` |
| Upload without registration (no token) | `401 { status: "unauthorized" }` |
| Upload from DEACTIVE sensor | `403 { status: "sensor_deactivated" }` |
| Config upload with version ≤ ACTIVE version | `409 { status: "version_not_forward" }` |
| Config upload with duplicate version | `409 { status: "version_conflict" }` |
| Config download with no global ACTIVE config | `404 { status: "no_configuration" }` |
| Config download from DEACTIVE sensor | `403 { status: "sensor_deactivated" }` |
| Config file missing from disk on download | `500 { status: "error", message: "Configuration file not found." }` |
| Delete non-existent sensor | `404 { status: "not_found" }` |
| Version-check with invalid semver | `400 { result: "INVALID_VERSION" }` |
| Concurrent registrations for same `sensorId` | DB unique constraint on `deviceId` → second call gets 409 |

---

## New Environment Variables

| Variable | Change | Default |
|----------|--------|---------|
| `AUTO_REGISTER_ON_UPLOAD` | **REMOVED** — no longer needed | — |

No new env vars introduced (all existing vars remain valid).

---

## Admin Nav Update

Nav items (unchanged count of 8, but one label/href changes):

| # | Label | Href | Change |
|---|-------|------|--------|
| 1 | Overview | `/admin/dashboard` | Unchanged |
| 2 | Sensors | `/admin/sensors` | Unchanged |
| 3 | Configuration Settings | `/admin/configs` | Unchanged href, content changes |
| 4 | Registration History | `/admin/history` | Unchanged, now read-only |
| 5 | Uploaded Files | `/admin/files` | Unchanged |
| 6 | Version Check Metrics | `/admin/version-check-metrics` | **Changed href** (was `/admin/metrics`) |
| 7 | Audit Logs | `/admin/audit` | Unchanged |
| 8 | Logout | — | Unchanged |

---

## Acceptance Criteria

- [ ] Given `POST /api/v1/sensors/register` with a new `sensorId`, then a 64-char hex token is returned in the response and `RegisteredDevice` + `DeviceRegistrationRequest[AUTO_APPROVED]` rows are created.
- [ ] Given `POST /api/v1/sensors/register` with an existing `sensorId`, then `409 already_registered`.
- [ ] Given a valid bearer token, when calling `POST /api/v1/sensors/heartbeat`, then `lastSeenAt` is updated and `200 ok` returned.
- [ ] Given a DEACTIVE sensor, when calling heartbeat, then `200 ok` (heartbeat not blocked by status).
- [ ] Given a valid bearer token and no global ACTIVE config, when calling `POST /api/v1/sensors/version-check`, then `NO_CONFIGURATION_AVAILABLE`.
- [ ] Given `POST /api/v1/sensors/version-check` that returns `UPDATE_AVAILABLE`, then `SensorVersionCheckEvent` row is written.
- [ ] Given a global ACTIVE config, when calling `GET /api/v1/sensors/configuration/download`, then raw config bytes returned and `SensorConfigDownloadEvent` row written.
- [ ] Given `POST /api/admin/configuration` with version `"1.0.0"` when ACTIVE is `"1.5.0"`, then `409 version_not_forward`.
- [ ] Given `POST /api/admin/configuration/[id]/activate`, then old ACTIVE config → ARCHIVED, new → ACTIVE (atomic).
- [ ] Given `DELETE /api/admin/sensors/[id]` with user confirmation, then `RegisteredDevice` deleted, token revoked, audit event written.
- [ ] Given `/admin/history`, approve/reject buttons do NOT appear.
- [ ] Given `/admin/version-check-metrics` with a 7-day date range, then per-day rows with ACTIVE/DEACTIVE sensor counts are shown.
- [ ] Given old paths (`/api/upload`, `/api/sensor/*`), they return 404 (routes deleted).
- [ ] All 26 existing unit tests pass after changes.

---

## Assumptions

1. All existing data is test/seed data — destructive migration of per-sensor config tables is acceptable.
2. Sensor clients will be updated to use new `/api/v1/sensors/*` paths — old paths are not redirected.
3. The semver `>` comparison uses a simple integer tuple comparison: `(major, minor, patch)` — no pre-release or build metadata handling needed.
4. The heartbeat endpoint does NOT update `firstSeenAt` (that is set at registration time or first auth). The `requireSensorAuth()` guard handles `firstSeenAt` / `lastSeenAt` updates; the heartbeat route can additionally update telemetry fields.

---

## Open Decisions

All resolved:

| Question | Decision |
|----------|---------|
| Config version forward-only | Reject if new version ≤ ACTIVE version (strict `>` comparison) |
| Global config partial unique index | DB-level: one `ACTIVE` row across entire table |
| Heartbeat blocked by DEACTIVE? | No — always `200 ok` |
| Token issuance actor | Auto-issued at register; admin can only revoke |
| Old sensor API path backward compat | Not preserved — clients must update |
| Metrics data source for active/deactive split | `SensorVersionCheckEvent` joined with `RegisteredDevice.status` at query time |
| `DailySensorVersionCheckMetric` model | Keep for result breakdown counts; live join for active/deactive split |

---

## Specification Completion Checklist

- [x] Scope clear (in-scope and out-of-scope listed)
- [x] All new endpoints specified with request/response schemas
- [x] All deleted endpoints listed
- [x] All new DB models specified with field-level detail
- [x] All deleted DB tables listed
- [x] Security requirements included
- [x] Error cases fully enumerated
- [x] Acceptance criteria complete (14 checks)
- [x] Assumptions documented
- [x] Open decisions resolved
