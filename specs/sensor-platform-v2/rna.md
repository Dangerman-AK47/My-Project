# RnA: Sensor Platform v3 — Global Config, Auto-Register, API v1 Routing

## Objective

Refactor the existing Sensor Platform v2 application to implement:
1. A **global sensor configuration** model (one shared config for ALL sensors, replacing per-sensor configs).
2. **Fully automatic sensor registration** via a dedicated `POST /api/v1/sensors/register` endpoint that issues a token once in the response.
3. **API versioning** — all sensor-facing endpoints move under `/api/v1/sensors/*`.
4. A **sensor heartbeat** endpoint (`POST /api/v1/sensors/heartbeat`).
5. **Config download event tracking** (`fv_sensor_config_download_events` table).
6. **Permanent sensor deletion** with token revocation and confirmation UI.
7. **Revised version-check metrics** page (`/admin/version-check-metrics`) showing ACTIVE vs DEACTIVE sensor counts and unique sensor counts per day.
8. **Registration History** page becomes read-only — no approve/reject actions since registration is now automatic.

All existing data and working features must be preserved. No rebuild from scratch.

---

## Applicable Rules

- [x] `workflow-rules.md` — SDD gate sequence enforced (RnA → spec → plan+task → implementation)
- [x] `architecture-rules.md` — Next.js App Router patterns, service layer, StorageDriver abstraction
- [x] `security-rules.md` — Auth layers (Edge middleware + DB guard), token hashing, no secrets in logs
- [x] `database-rules.md` — `fv_` table prefix, Prisma migrations, transactional writes, audit events
- [x] `ui-rules.md` — Tailwind design tokens, responsive layout, AdminShell nav

---

## Existing System Analysis (v2 Baseline)

### Current Implementation State

The application was fully implemented in the previous session (v2). The following is an accurate audit of the current state:

#### Database (Prisma schema — current)

| Model / Enum | Table Name | Status |
|-------------|-----------|--------|
| `AdminAccount` | `fv_admin_accounts` | ✅ Unchanged |
| `RegisteredDevice` | `fv_registered_devices` | ✅ Has `tokenHash`, `firstSeenAt`, `lastSeenAt`, `sensorVersion`, `firmwareVersion`, `hardwareModel`, `metadata` |
| `DeviceRegistrationRequest` | `fv_device_registration_requests` | ✅ Has `AUTO_APPROVED` status |
| `UploadedFileRecord` | `fv_uploaded_file_records` | ✅ Unchanged |
| `UploadStorageObject` | `fv_upload_storage_objects` | ✅ Unchanged |
| `DeviceStatusEvent` | `fv_device_status_events` | ✅ Uses `ACTIVE`/`DEACTIVE` |
| `AdminAuditEvent` | `fv_admin_audit_events` | ✅ Unchanged |
| `SensorConfiguration` | `fv_sensor_configurations` | ⚠️ **PER-SENSOR** (has `registeredDeviceId` FK) — must be replaced |
| `SensorConfigStorageObject` | `fv_sensor_config_storage_objects` | ⚠️ Points to per-sensor config — must be replaced |
| `SensorVersionCheckEvent` | `fv_sensor_version_check_events` | ✅ Exists — schema may need minor updates |
| `DailySensorVersionCheckMetric` | `fv_daily_sensor_version_check_metrics` | ✅ Exists — may need restructuring for global counts |
| `DeviceStatus` enum | — | ✅ `ACTIVE` / `DEACTIVE` |
| `ConfigurationStatus` enum | — | ✅ `INACTIVE` / `ACTIVE` / `ARCHIVED` |
| `VersionCheckResult` enum | — | ✅ `CURRENT` / `UPDATE_AVAILABLE` / `SENSOR_DEACTIVATED` / `NO_CONFIGURATION_AVAILABLE` / `INVALID_VERSION` / `SENSOR_NOT_REGISTERED` |

#### Current API Routes

| Route | Path | Status |
|-------|------|--------|
| Public upload | `POST /api/upload` | ✅ Exists — must be moved/aliased to `POST /api/v1/sensors/upload` |
| Public registration | `POST /api/device-requests` | ✅ Exists — manual flow; to be replaced by auto-register |
| Sensor version-check | `POST /api/sensor/version-check` | ✅ Exists — must move to `POST /api/v1/sensors/version-check` |
| Sensor config download | `GET /api/sensor/config` | ✅ Exists — must move to `GET /api/v1/sensors/configuration/download` |
| Admin sensor list | `GET /api/admin/sensors` | ✅ Exists |
| Admin sensor detail | `GET /api/admin/sensors/[id]` | ✅ Exists |
| Admin sensor status | `PATCH /api/admin/sensors/[id]/status` | ✅ Exists |
| Admin token issue | `POST /api/admin/sensors/[id]/token` | ✅ Exists — **semantics change**: token no longer issued by admin; auto-issued on register |
| Admin token delete | `DELETE /api/admin/sensors/[id]/token` | ✅ Exists |
| Admin config list | `GET /api/admin/sensors/[id]/configs` | ✅ Exists — per-sensor; must be replaced |
| Admin config upload | `POST /api/admin/sensors/[id]/configs` | ✅ Exists — per-sensor; must be replaced |
| Admin config activate | `POST /api/admin/sensors/[id]/configs/[configId]/activate` | ✅ Exists — per-sensor; must be replaced |
| Admin history | `GET /api/admin/history` | ✅ Exists |
| Admin history approve | `POST /api/admin/history/[id]/approve` | ✅ Exists — to be **removed** (no manual approval in v3) |
| Admin history reject | `POST /api/admin/history/[id]/reject` | ✅ Exists — to be **removed** (no manual approval in v3) |
| Admin configs overview | `GET /api/admin/configs` | ✅ Exists — per-sensor overview; must be replaced |
| Admin metrics | `GET /api/admin/metrics` | ✅ Exists — must be updated for new metric structure |
| Admin audit | `GET /api/admin/audit` | ✅ Exists |
| Admin stats | `GET /api/admin/stats` or `/sensors/stats` | ✅ Exists |

#### Current Admin Pages

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/admin/dashboard` | ✅ Exists |
| Sensors list | `/admin/sensors` | ✅ Exists |
| Sensor detail | `/admin/sensors/[id]` | ✅ Exists — has per-sensor config section; must be revised |
| Configuration Settings | `/admin/configs` | ✅ Exists — per-sensor; must become global config page |
| Registration History | `/admin/history` | ✅ Exists — has approve/reject; must become read-only |
| Uploaded Files | `/admin/files` | ✅ Exists — unchanged |
| Version Check Metrics | `/admin/metrics` | ✅ Exists — structure changes needed |
| Audit Logs | `/admin/audit` | ✅ Exists |

#### Current Service Files

| File | Status |
|------|--------|
| `src/lib/auth/sensor-guard.ts` | ✅ Exists — `requireSensorAuth()` |
| `src/lib/services/sensor-tokens.ts` | ✅ Exists — `issueSensorToken()`, `revokeSensorToken()` |
| `src/lib/services/sensor-configs.ts` | ⚠️ Exists but **per-sensor** — must be rewritten for global config |
| `src/lib/services/version-check.ts` | ✅ Exists — `performVersionCheck()` |
| `src/lib/services/registration-requests.ts` | ✅ Exists — `autoRegisterSensor()` already added |
| `src/lib/validation/semver.ts` | ✅ Exists |

---

## Requirements Delta: v2 → v3

### Change 1 — Global Configuration (Biggest Change)

**Current (v2):** `SensorConfiguration` has a `registeredDeviceId` FK — one config object per sensor. Each sensor has its own ACTIVE config. Admin uploads and activates configs per sensor.

**New (v3):** There is ONE global configuration shared by ALL sensors. No sensor FK on the config model. The table is `fv_global_sensor_configurations`. A companion table `fv_global_config_storage_objects` stores the file. Only one `ACTIVE` global config exists at any time (enforced by partial unique index across all rows, not scoped by sensor).

**Impact:** Drop or migrate `SensorConfiguration` → create `GlobalSensorConfiguration`. Drop or migrate `SensorConfigStorageObject` → create `GlobalConfigStorageObject`. All per-sensor config API routes and the sensor detail config section are removed. A new global config management page replaces them.

---

### Change 2 — Auto Registration Endpoint

**Current (v2):** Sensors are auto-registered by the `POST /api/upload` route (controlled by `AUTO_REGISTER_ON_UPLOAD` env var). Token is issued manually by admin after registration.

**New (v3):** A dedicated `POST /api/v1/sensors/register` endpoint handles registration. The body contains `{ sensorId }`. The endpoint:
- Creates `RegisteredDevice` (status `ACTIVE`) and a `DeviceRegistrationRequest` (status `AUTO_APPROVED`) atomically.
- Issues a bearer token immediately (same 32-byte CSPRNG hex as v2).
- Returns `{ token }` **once** in the response body — never again.
- If `sensorId` already exists → returns `409 conflict`.
- No admin action required.

The `POST /api/upload` route continues to exist at its new path (`POST /api/v1/sensors/upload`) but NO LONGER auto-registers sensors. If the sensor is not registered, it returns `404`. Sensors must call `/register` first.

---

### Change 3 — API Versioning (`/api/v1/sensors/*`)

All sensor-facing routes move to the `/api/v1/sensors/` path prefix:

| Old path | New path |
|----------|---------|
| `POST /api/upload` | `POST /api/v1/sensors/upload` |
| `POST /api/sensor/version-check` | `POST /api/v1/sensors/version-check` |
| `GET /api/sensor/config` | `GET /api/v1/sensors/configuration/download` |
| _(new)_ | `POST /api/v1/sensors/register` |
| _(new)_ | `POST /api/v1/sensors/heartbeat` |

Admin routes stay at `/api/admin/*` — no versioning change needed.

---

### Change 4 — Heartbeat Endpoint (New)

`POST /api/v1/sensors/heartbeat` (bearer-authed). Body: `{ sensorId, sensorVersion?, firmwareVersion?, hardwareModel?, metadata? }`.

Updates `RegisteredDevice.lastSeenAt`, `sensorVersion`, `firmwareVersion`, `hardwareModel`, `metadata` atomically. Returns `{ status: "ok", serverTime: "..." }`. If sensor is `DEACTIVE`, still responds with `200 { status: "ok" }` (heartbeat is not blocked by sensor status — it is a telemetry-only endpoint).

---

### Change 5 — Config Download Event Tracking (New)

A new table `fv_sensor_config_download_events` logs every `GET /api/v1/sensors/configuration/download` call.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | |
| `registeredDeviceId` | `String?` | FK → `RegisteredDevice` (SetNull on delete) |
| `deviceId` | `String` | Denormalized |
| `globalConfigId` | `String?` | FK → `GlobalSensorConfiguration` (SetNull on delete) |
| `configVersion` | `String?` | Snapshot of config version at download time |
| `ipAddress` | `String?` | |
| `userAgent` | `String?` | |
| `createdAt` | `DateTime @default(now())` | |

---

### Change 6 — Permanent Sensor Deletion

Admin can permanently delete a sensor (with confirmation dialog in the UI). Deletion:
1. Revokes the sensor's token (sets `tokenHash = null`).
2. Deletes the `RegisteredDevice` row (cascades to `DeviceStatusEvent`, `SensorVersionCheckEvent`, `UploadedFileRecord` per existing `onDelete` policies).
3. Writes an `AdminAuditEvent` with action `SENSOR_DELETED`.
4. Confirmation modal must show the sensor ID and warn about data loss.

---

### Change 7 — Revised Version-Check Metrics Page

The metrics page at `/admin/version-check-metrics` (renamed from `/admin/metrics`) shows:
- Date range filter (default: last 7 days)
- Per-day counts of **ACTIVE** sensors that called version-check vs **DEACTIVE** sensors
- Unique sensor count per day
- Result breakdown table (CURRENT / UPDATE_AVAILABLE / NO_CONFIGURATION_AVAILABLE etc.)

The `DailySensorVersionCheckMetric` model may need to gain `sensorStatus` tracking, or the page may query `SensorVersionCheckEvent` directly for the active/deactive breakdown (acceptable given typical event volumes).

---

### Change 8 — Registration History Becomes Read-Only

The registration history page at `/admin/history` remains but:
- Approve/Reject actions are **removed** (registration is now fully automatic).
- Page is read-only — shows `AUTO_APPROVED` status for all new sensors.
- Old PENDING/APPROVED/REJECTED records remain visible for historical data.
- `POST /api/admin/history/[id]/approve` and `POST /api/admin/history/[id]/reject` routes are **deleted**.

---

### Change 9 — Token Issuance Moves from Admin to Auto-Register

In v2, the admin issued tokens via `POST /api/admin/sensors/[id]/token`. In v3:
- Tokens are auto-issued at registration time via `POST /api/v1/sensors/register`.
- The admin token issue endpoint `POST /api/admin/sensors/[id]/token` is **removed**.
- The admin token revoke endpoint `DELETE /api/admin/sensors/[id]/token` is **kept** (admins can still revoke a sensor's token to block it).
- The sensor detail page's "Issue Token" UI section is **removed**; a "Revoke Token" button remains.

---

## Existing Patterns to Preserve

All v2 patterns remain in force:

1. **Service layer** — Business logic in `src/lib/services/*.ts`.
2. **Transactional writes** — `prisma.$transaction()` + `recordAuditEvent()` inside.
3. **StorageDriver abstraction** — `save`, `read`, `delete` only. Config files use the same driver.
4. **Error classes** — Typed error classes thrown from services, caught in route handlers.
5. **Env validation** — All env vars in `src/lib/env.ts` using Zod.
6. **`fv_` table prefix** — All new Prisma models use `@@map("fv_...")`.
7. **`export const runtime = "nodejs"`** — All sensor API routes.
8. **Middleware scope** — Sensor API routes (`/api/v1/sensors/*`) are NOT in the Edge middleware matcher. Sensor auth is handled within route handlers.
9. **bcrypt cost 12** — Token hashing.
10. **No token in logs** — Token value never logged; only first 8 chars may be used for correlation.

---

## External Research

- **Semver validation** — existing `src/lib/validation/semver.ts` with `/^\d+\.\d+\.\d+$/` regex — unchanged.
- **Global config partial unique index** — Scope changes from `WHERE "registeredDeviceId" = ?` to a table-wide constraint: one row with `status = 'ACTIVE'` across all rows. In PostgreSQL: `CREATE UNIQUE INDEX ... ON fv_global_sensor_configurations(id) WHERE status = 'ACTIVE'` is incorrect; the right approach is `CREATE UNIQUE INDEX ... ON fv_global_sensor_configurations((status)) WHERE status = 'ACTIVE'` or using a constant expression. Simpler: enforce in the service layer with a transaction that sets all `ACTIVE` → `ARCHIVED` before activating the new one — the existing pattern already works this way; the partial index just adds a DB-level guard. For global scope, use: `CREATE UNIQUE INDEX "fv_global_sensor_configurations_active_unique" ON "fv_global_sensor_configurations"((1)) WHERE status = 'ACTIVE';` — one row may satisfy the predicate, enforcing at most one ACTIVE.
- **`AUTO_REGISTER_ON_UPLOAD` env var** — Will be repurposed or removed since auto-registration is now via a dedicated endpoint, not on upload.
- **Config upload validation** — New requirement: uploading a config with a semver version **lower than or equal to** the current ACTIVE config's version must be rejected (to enforce forward-only versioning). This requires a semver `>` comparison at upload time.

---

## Options Considered

### Option A — Migrate per-sensor tables to global (rename + drop FK)

**Approach:** Create new `fv_global_sensor_configurations` and `fv_global_config_storage_objects` tables. Drop the old `fv_sensor_configurations` and `fv_sensor_config_storage_objects` tables. Migrate any existing config data (all existing records would become "global" configs — their `registeredDeviceId` FK is dropped).

**Pros:** Clean schema. Old table names gone.

**Cons:** Any existing per-sensor config data is lost or must be manually consolidated to a single record. Migration is destructive.

**Decision:** Acceptable. Local dev only. Existing per-sensor config data is test/seed data only.

---

### Option B — Keep old tables, add new global tables alongside

**Approach:** Add `fv_global_sensor_configurations` as new tables. Keep old `fv_sensor_configurations` as dead tables until a later cleanup migration.

**Pros:** No data loss.

**Cons:** Schema clutter. Two config table sets confuse future developers.

**Decision:** Rejected. Clean migration preferred.

---

## Recommended Direction

**Option A** — Drop per-sensor config tables, create global config tables. This is local dev only — no production data at risk. The clean schema is worth the one-time migration cost.

For the API versioning, create new route files under `src/app/api/v1/sensors/`. The old `src/app/api/sensor/` and `src/app/api/upload/` routes are **deleted**. The middleware matcher for `/api/admin/*` is unchanged; it does **not** cover `/api/v1/sensors/*`.

---

## Open Questions

All design questions resolved by user prior to this RnA:

| Question | Decision |
|----------|---------|
| Config version format | Strict semver — reject uploads with version ≤ current ACTIVE version |
| Global config uniqueness | DB-level partial unique index (table-wide, not per-sensor) |
| Config file size limit | Same as data uploads (`MAX_FILE_SIZE_MB`) |
| Auto-register scope | Always via dedicated `/api/v1/sensors/register` endpoint (not on upload) |
| Heartbeat blocked by DEACTIVE? | No — heartbeat always succeeds (telemetry-only) |
| Token issuance actor | Auto-issued on register only; admin can only revoke |
| Metrics page structure | ACTIVE vs DEACTIVE counts + unique sensor count per day, date range filter |

---

## Requirements Discovered

### Functional Requirements

1. **Global config model** — Replace per-sensor `SensorConfiguration` with `GlobalSensorConfiguration`. One ACTIVE config for all sensors at any time.
2. **Config download events** — Every `GET /api/v1/sensors/configuration/download` call writes a `SensorConfigDownloadEvent`.
3. **Config version forward-only** — Uploading a config version that is ≤ current ACTIVE config's semver is rejected with `409`.
4. **Auto-register endpoint** — `POST /api/v1/sensors/register` creates sensor + issues token in one transaction.
5. **Heartbeat endpoint** — `POST /api/v1/sensors/heartbeat` updates telemetry. Always `200`.
6. **API versioning** — All sensor endpoints under `/api/v1/sensors/`.
7. **Sensor deletion** — `DELETE /api/admin/sensors/[id]` permanently deletes with confirmation.
8. **Read-only history** — Approve/reject routes and UI removed.
9. **Token auto-issued** — Admin token-issue endpoint removed; only revoke remains.
10. **Version-check metrics revamp** — ACTIVE/DEACTIVE split + unique sensor counts + date range filter.

### Non-Functional Requirements

1. All sensor routes: `export const runtime = "nodejs"`.
2. Registration and upload are separate API calls — sensors must register before uploading.
3. No token ever stored in plain text.
4. Config upload with non-forward semver rejected at service layer (before storage).
5. Sensor deletion is permanent — no soft-delete. Admin confirmation required in UI.
6. Middleware matcher must be updated to include `/api/v1/sensors/*` if Edge JWT protection is desired, OR sensor routes remain unprotected at the Edge (sensor auth handled inside route handler). **Decision: sensor routes are NOT in the Edge matcher — sensor auth is done in Node runtime within each route handler.** This is consistent with v2.

---

## Constraints

- **PowerShell execution policy** — All commands use `cmd /c node_modules\\.bin\\<cmd>` or `node --import tsx <file>`.
- **Prisma migration** — Old config tables must be dropped. New global config tables created. Raw SQL in migration for partial unique index.
- **`BigInt` serialization** — Existing `totalStorageBytes` pattern preserved.
- **Edge runtime** — `/api/v1/sensors/*` routes cannot be on the Edge runtime.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Dropping `fv_sensor_configurations` breaks references in service code | High | Medium | Rewrite `sensor-configs.ts` service completely; TypeScript will catch misses |
| Semver `>` comparison logic error | Medium | Low | Use existing `semverSchema` + write a `semverGt(a, b)` comparison function; add unit test |
| Double-registration race on `POST /api/v1/sensors/register` | Low | Low | DB `unique` constraint on `RegisteredDevice.deviceId` prevents double-insert; return 409 on conflict |
| `/api/upload` is still called by existing clients | Medium | Medium | Old path must be removed and clients updated; document clearly in README |
| Metrics page complexity (active/deactive split) | Medium | Low | Can join `SensorVersionCheckEvent` with `RegisteredDevice.status` at query time for the split |

---

## RnA Completion Checklist

- [x] Current v2 implementation audited (all models, all routes, all pages, all service files)
- [x] Delta from v2 to v3 requirements fully documented (9 changes)
- [x] New table names confirmed (`fv_global_sensor_configurations`, `fv_global_config_storage_objects`, `fv_sensor_config_download_events`)
- [x] API path changes documented
- [x] Option analysis complete (Option A selected)
- [x] All open questions resolved
- [x] Risks identified
