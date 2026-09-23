# Task Breakdown: Sensor Platform v3 — Global Config, API v1, Auto-Register

## Status

DRAFT — AWAITING USER APPROVAL

## References

- RnA: `rna.md`
- Specification: `spec.md`
- Plan: `plan.md`

---

## Dependency Graph

```text
T001 (Schema + Migration)
  └── T002 (Environment cleanup)
        ├── T003 (semver.ts — add semverGt)
        │     └── T004 (Rewrite sensor-configs.ts — global)
        │           ├── T008 (Admin config routes)
        │           │     └── T016 (Configs page rewrite)
        │           └── T009 (version-check route update)
        ├── T005 (registration-requests.ts — autoRegisterWithToken)
        │     └── T007 (Register endpoint)
        ├── T006 (devices.ts — deleteSensor)
        │     └── T010 (Admin DELETE /sensors/[id])
        │           └── T015 (Sensor detail page update)
        ├── T011 (Heartbeat endpoint)
        ├── T012 (Upload endpoint — /api/v1/sensors/upload)
        ├── T013 (Config download endpoint)
        │     └── (uses T004 getActiveGlobalConfig)
        ├── T014 (Nav update)
        ├── T017 (History page — remove approve/reject)
        ├── T018 (Metrics page — /admin/version-check-metrics)
        └── T010 (Admin sensor list: delete button)

T019 (Delete old routes)
T020 (Tests — update + new)
T021 (Final verification + README)
```

---

## Tasks

### T001 — Database Schema + Migration

- **Description:** Edit `prisma/schema.prisma` to:
  - Remove `SensorConfiguration` model and `SensorConfigStorageObject` model.
  - Remove the old relations from `AdminAccount` (`uploadedConfigs`, `activatedConfigs`) and `RegisteredDevice` (`configurations`).
  - Add `GlobalSensorConfiguration` model (`fv_global_sensor_configurations`).
  - Add `GlobalConfigStorageObject` model (`fv_global_config_storage_objects`).
  - Add `SensorConfigDownloadEvent` model (`fv_sensor_config_download_events`).
  - Add new relations: `AdminAccount.uploadedGlobalConfigs`, `AdminAccount.activatedGlobalConfigs`, `RegisteredDevice.configDownloads`.
  - Run `prisma migrate dev --create-only`, manually edit migration SQL to:
    - DROP old tables first (in FK order: storage objects before configurations).
    - Append partial unique index for global ACTIVE config.
  - Apply migration and regenerate Prisma client.
  - Update seed.ts to remove any SensorConfiguration seed data.
- **Files:**
  - `prisma/schema.prisma` — MODIFY
  - `prisma/migrations/<ts>_sensor_platform_v3/migration.sql` — NEW (generated + hand-edited)
  - `prisma/seed.ts` — MODIFY
- **Dependencies:** None — foundation task.
- **Commands:**
  ```bash
  cmd /c node_modules\.bin\prisma migrate dev --name sensor_platform_v3 --create-only
  # (hand-edit migration.sql)
  cmd /c node_modules\.bin\prisma migrate dev
  cmd /c node_modules\.bin\prisma generate
  node --import tsx prisma/seed.ts
  ```
- **Acceptance criteria:** `prisma migrate status` → all applied. `prisma generate` → 0 errors. Global ACTIVE partial unique index confirmed. Old tables gone.
- **Complexity:** L

---

### T002 — Environment Cleanup

- **Description:** Remove `AUTO_REGISTER_ON_UPLOAD` from `src/lib/env.ts` Zod schema. Remove from `.env` and `.env.example`. This env var is no longer needed since upload no longer auto-registers.
- **Files:**
  - `src/lib/env.ts` — MODIFY (remove `AUTO_REGISTER_ON_UPLOAD`)
  - `.env` — MODIFY (remove `AUTO_REGISTER_ON_UPLOAD` line)
  - `.env.example` — MODIFY (remove `AUTO_REGISTER_ON_UPLOAD` line)
- **Dependencies:** T001
- **Acceptance criteria:** `getEnv()` no longer has `AUTO_REGISTER_ON_UPLOAD`. `tsc --noEmit` → 0 errors.
- **Complexity:** S

---

### T003 — Semver `gt` Comparison Function

- **Description:** Add `semverGt(a: string, b: string): boolean` to `src/lib/validation/semver.ts`. Parses `"major.minor.patch"` from both strings and returns `true` if `a > b` as an integer tuple comparison. Handles invalid input gracefully (throw or return false — document behavior).
- **Files:**
  - `src/lib/validation/semver.ts` — MODIFY
- **Dependencies:** T001
- **Acceptance criteria:** `semverGt("2.0.0", "1.9.9")` → `true`. `semverGt("1.0.0", "1.0.0")` → `false`. `semverGt("1.0.0", "1.5.0")` → `false`. Unit test in T020.
- **Complexity:** S

---

### T004 — Rewrite Sensor Config Service (Global)

- **Description:** Completely rewrite `src/lib/services/sensor-configs.ts` for the global config model. Remove all per-sensor logic. Implement:
  - `uploadGlobalConfig(input)`: validate semver, check if version already exists (throw `GlobalConfigVersionConflictError`), if an ACTIVE config exists check new version > ACTIVE version (throw `GlobalConfigVersionNotForwardError` if not), save file via StorageDriver, create `GlobalSensorConfiguration` (INACTIVE) + `GlobalConfigStorageObject` in one transaction.
  - `activateGlobalConfig(configId, adminId)`: in one transaction: all existing ACTIVE → ARCHIVED, target → ACTIVE, set `activatedAt` + `activatedByAdminId`, write `AdminAuditEvent(GLOBAL_CONFIG_ACTIVATED)`.
  - `listGlobalConfigs()`: all records, newest first.
  - `getActiveGlobalConfig()`: single ACTIVE record or null.
  - Error classes: `GlobalConfigNotFoundError`, `GlobalConfigVersionConflictError`, `GlobalConfigVersionNotForwardError`.
- **Files:**
  - `src/lib/services/sensor-configs.ts` — REWRITE
- **Dependencies:** T001, T002, T003
- **Acceptance criteria:** All 4 functions compile. Upload with lower/equal version → throws `GlobalConfigVersionNotForwardError`. Activation archives old ACTIVE. Unit test in T020.
- **Complexity:** L

---

### T005 — Registration Service Update

- **Description:** Update `src/lib/services/registration-requests.ts`:
  - Add `autoRegisterWithToken(deviceId: string): Promise<{ token: string; device: RegisteredDevice }>`:
    - Check uniqueness (throw `DuplicateRegistrationError` if `deviceId` exists).
    - Generate 32-byte CSPRNG hex token.
    - In one transaction: create `RegisteredDevice(ACTIVE)`, create `DeviceRegistrationRequest(AUTO_APPROVED)`, store bcrypt hash (cost 12) in `RegisteredDevice.tokenHash`, write `AdminAuditEvent(SENSOR_REGISTERED, adminId=null)`.
    - Return `{ token: plainTextToken, device }`.
  - Remove or deprecate the old `autoRegisterSensor()` function (which didn't issue a token). Check if any other route still calls it — if so, update those callers first.
  - Add `DuplicateRegistrationError` error class.
- **Files:**
  - `src/lib/services/registration-requests.ts` — MODIFY
- **Dependencies:** T001, T002
- **Acceptance criteria:** `autoRegisterWithToken("DEV-NEW-001")` creates device + request + returns token. Second call with same `deviceId` → `DuplicateRegistrationError`. Unit test in T020.
- **Complexity:** M

---

### T006 — Sensor Deletion Service

- **Description:** Add `deleteSensor(deviceId: string, adminId: string): Promise<void>` to `src/lib/services/devices.ts`. In one transaction:
  1. Find `RegisteredDevice` by `deviceId` → throw `DeviceNotFoundError` if not found.
  2. Write `AdminAuditEvent({ action: "SENSOR_DELETED", entityType: "RegisteredDevice", entityId: device.id, adminId })`.
  3. Delete `RegisteredDevice` (cascades to `DeviceStatusEvent`; `SensorVersionCheckEvent` uses `SetNull` on device delete — confirm existing `onDelete` policies are correct in schema).
- **Files:**
  - `src/lib/services/devices.ts` — MODIFY
- **Dependencies:** T001
- **Acceptance criteria:** Valid `deviceId` → device deleted + audit event written. Unknown `deviceId` → `DeviceNotFoundError`. TypeScript compiles cleanly.
- **Complexity:** M

---

### T007 — Register Endpoint (`POST /api/v1/sensors/register`)

- **Description:** Create `src/app/api/v1/sensors/register/route.ts`.
  - `export const runtime = "nodejs"`.
  - Parse + validate body: `{ sensorId: string }` using existing deviceId Zod schema.
  - Call `autoRegisterWithToken(sensorId)`.
  - Return `201 { sensorId, token }`.
  - Error map: `DuplicateRegistrationError` → `409 { status: "already_registered" }`. Zod error → `400 { status: "validation_error" }`. Generic → `500`.
- **Files:**
  - `src/app/api/v1/sensors/register/route.ts` — NEW
- **Dependencies:** T005
- **Acceptance criteria:** `POST /api/v1/sensors/register` with new `sensorId` → 201 + token. Second call → 409. Bad `sensorId` format → 400.
- **Complexity:** M

---

### T008 — Admin Global Config Routes

- **Description:** Create global config management admin API routes:
  - `src/app/api/admin/configuration/route.ts` — `GET` (list all global configs) + `POST` (upload new config, multipart: `file` + `configVersion`).
  - `src/app/api/admin/configuration/[id]/activate/route.ts` — `POST` (activate a config).
  - Error maps: `GlobalConfigVersionConflictError` → 409 `version_conflict`. `GlobalConfigVersionNotForwardError` → 409 `version_not_forward`. `GlobalConfigNotFoundError` → 404. File too large → 413.
- **Files:**
  - `src/app/api/admin/configuration/route.ts` — NEW
  - `src/app/api/admin/configuration/[id]/activate/route.ts` — NEW
- **Dependencies:** T004
- **Acceptance criteria:** Upload → `INACTIVE` config created. Activate → old ACTIVE archived, new ACTIVE. Version ≤ current → 409.
- **Complexity:** M

---

### T009 — Version-Check Route Update

- **Description:** Update `src/app/api/v1/sensors/version-check/route.ts` (new location — this is a NEW file, old route at `/api/sensor/version-check` is deleted separately in T019). Implement the version-check endpoint using `getActiveGlobalConfig()` instead of per-sensor config lookup. Logic otherwise identical to v2 FR-004.
  
  Note: `performVersionCheck()` in `version-check.ts` must also be updated (in T004 scope or here) to call `getActiveGlobalConfig()`.
- **Files:**
  - `src/app/api/v1/sensors/version-check/route.ts` — NEW
  - `src/lib/services/version-check.ts` — MODIFY (use global config)
- **Dependencies:** T004, T005
- **Acceptance criteria:** Version-check against global ACTIVE config. `SensorVersionCheckEvent` written on every call.
- **Complexity:** M

---

### T010 — Admin Sensor Delete Route

- **Description:** Add `DELETE` handler to `src/app/api/admin/sensors/[id]/route.ts` (or create a dedicated `src/app/api/admin/sensors/[id]/delete/route.ts`). Calls `deleteSensor(deviceId, admin.id)`.

  Also update `src/app/api/admin/sensors/[id]/token/route.ts`: the `POST` method (issue token) is **removed**; only the `DELETE` method (revoke token) remains. If the file only has POST+DELETE, convert it to DELETE-only.
- **Files:**
  - `src/app/api/admin/sensors/[id]/route.ts` — MODIFY (add DELETE handler)
  - `src/app/api/admin/sensors/[id]/token/route.ts` — MODIFY (remove POST handler; keep DELETE)
- **Dependencies:** T006
- **Acceptance criteria:** `DELETE /api/admin/sensors/[id]` → sensor deleted. `DELETE /api/admin/sensors/[id]/token` → token revoked. `POST /api/admin/sensors/[id]/token` → 405 Method Not Allowed (or route removed).
- **Complexity:** M

---

### T011 — Heartbeat Endpoint (`POST /api/v1/sensors/heartbeat`)

- **Description:** Create `src/app/api/v1/sensors/heartbeat/route.ts`.
  - `export const runtime = "nodejs"`.
  - `requireSensorAuth(request)` → device.
  - Parse body: `{ sensorId, sensorVersion?, firmwareVersion?, hardwareModel?, metadata? }`.
  - Cross-validate: `body.sensorId === device.deviceId` → else 401.
  - `prisma.registeredDevice.update(...)` — update `lastSeenAt = now()` and any provided telemetry fields.
  - Return `200 { status: "ok", serverTime: new Date().toISOString() }`.
  - DEACTIVE sensor → still `200 ok` (no status check on heartbeat).
- **Files:**
  - `src/app/api/v1/sensors/heartbeat/route.ts` — NEW
- **Dependencies:** T001, T002
- **Acceptance criteria:** Valid token → `lastSeenAt` updated + 200 ok. DEACTIVE sensor → 200 ok. Missing token → 401. `sensorId` mismatch → 401.
- **Complexity:** M

---

### T012 — Upload Endpoint (`POST /api/v1/sensors/upload`)

- **Description:** Create `src/app/api/v1/sensors/upload/route.ts`. Same logic as the old `POST /api/upload` **except**:
  - Authentication via `requireSensorAuth(request)` (bearer token required — no auto-registration).
  - If token is invalid/missing → `401 unauthorized`.
  - If sensor is DEACTIVE → `403 sensor_deactivated`.
  - If sensor is ACTIVE → proceed with `recordUpload()`.
  - `export const runtime = "nodejs"`.
- **Files:**
  - `src/app/api/v1/sensors/upload/route.ts` — NEW
- **Dependencies:** T001, T002
- **Acceptance criteria:** Valid token + ACTIVE → upload succeeds. Invalid token → 401. DEACTIVE → 403.
- **Complexity:** M

---

### T013 — Config Download Endpoint (`GET /api/v1/sensors/configuration/download`)

- **Description:** Create `src/app/api/v1/sensors/configuration/download/route.ts`.
  - `export const runtime = "nodejs"`.
  - `requireSensorAuth(request)` → device.
  - Check `device.status === "ACTIVE"` → else 403.
  - `getActiveGlobalConfig()` → null → 404.
  - `StorageDriver.read(config.storageKey)` → stream bytes.
  - Write `SensorConfigDownloadEvent` row (awaited): `registeredDeviceId`, `deviceId`, `globalConfigId`, `configVersion`, `ipAddress`, `userAgent`.
  - Return streaming response with correct `Content-Type` and `Content-Disposition: attachment; filename="<originalFileName>"`.
- **Files:**
  - `src/app/api/v1/sensors/configuration/download/route.ts` — NEW
- **Dependencies:** T004
- **Acceptance criteria:** ACTIVE sensor + ACTIVE global config → bytes returned + download event written. No global ACTIVE config → 404. DEACTIVE sensor → 403.
- **Complexity:** M

---

### T014 — Admin Metrics Route Update

- **Description:** Create `src/app/api/admin/version-check-metrics/route.ts`. Replaces old `/api/admin/metrics` route (deleted in T019).
  - Parse `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 7 days, max 90 days).
  - Query `SensorVersionCheckEvent` with `createdAt` in range, include `registeredDevice.status`.
  - Group by UTC date, compute: `activeSensors`, `deactiveSensors`, `uniqueSensors`, `resultBreakdown`.
  - Return `{ dateRange, dailySummary[] }`.
- **Files:**
  - `src/app/api/admin/version-check-metrics/route.ts` — NEW
- **Dependencies:** T001
- **Acceptance criteria:** Returns per-day summary. ACTIVE/DEACTIVE counts correct. Empty state on no data. Date range filter works.
- **Complexity:** M

---

### T015 — Sensor Detail Page Update

- **Description:** Update `src/app/admin/(protected)/sensors/[id]/page.tsx`:
  - **Remove:** Per-sensor config section (list of SensorConfiguration records, upload form, activate button).
  - **Remove:** "Issue Token" button and token issuance UI.
  - **Add:** "Revoke Token" button (calls `DELETE /api/admin/sensors/[id]/token`).
  - **Add:** "Delete Sensor" button → opens a confirmation modal showing the sensor ID with a warning ("This action is permanent and cannot be undone.") → on confirm, calls `DELETE /api/admin/sensors/[id]` → redirect to `/admin/sensors`.
  - Keep: Sensor detail info, telemetry fields, upload history.
- **Files:**
  - `src/app/admin/(protected)/sensors/[id]/page.tsx` — MODIFY
- **Dependencies:** T010
- **Acceptance criteria:** No per-sensor config UI. Issue Token button gone. Delete button shows confirmation modal. Revoke Token button works.
- **Complexity:** M

---

### T016 — Configuration Settings Page Rewrite

- **Description:** Rewrite `src/app/admin/(protected)/configs/page.tsx` for global config management:
  - Header: "Configuration Settings".
  - Active config card: shows current ACTIVE config version, file name, activated at date. If none: "No active configuration" empty state.
  - Config history table: all `GlobalSensorConfiguration` records. Columns: Version, Status badge, File Name, File Size, Uploaded At, Activated At, Actions.
  - Actions: "Activate" button for INACTIVE/ARCHIVED configs.
  - Upload form: `configVersion` (text, semver) + file picker + "Upload" button. Shows `409 version_not_forward` or `409 version_conflict` error message inline.
  - Fetches from `GET /api/admin/configuration`.
  - Upload calls `POST /api/admin/configuration`.
  - Activate calls `POST /api/admin/configuration/[id]/activate`.
- **Files:**
  - `src/app/admin/(protected)/configs/page.tsx` — REWRITE
- **Dependencies:** T008
- **Acceptance criteria:** Shows global config list. Upload creates INACTIVE config. Activate archives old, sets new ACTIVE. Forward-version error displayed inline.
- **Complexity:** L

---

### T017 — Registration History Page Update (Read-Only)

- **Description:** Update `src/app/admin/(protected)/history/page.tsx`:
  - Remove approve/reject buttons and action columns.
  - Page becomes fully read-only table.
  - Status badges: PENDING, APPROVED, REJECTED, CANCELLED, AUTO_APPROVED (with distinct colors).
  - Add informational note: "Registration is now automatic. All new sensors register via the API."
- **Files:**
  - `src/app/admin/(protected)/history/page.tsx` — MODIFY
- **Dependencies:** None (API GET endpoint unchanged)
- **Acceptance criteria:** No approve/reject buttons visible. All status values displayed. Read-only table renders correctly.
- **Complexity:** S

---

### T018 — Version-Check Metrics Page

- **Description:** Create `src/app/admin/(protected)/version-check-metrics/page.tsx`. 
  - Date range picker (from/to, default last 7 days).
  - Per-day summary table: Date | Active Sensors | Deactive Sensors | Unique Sensors | CURRENT | UPDATE_AVAILABLE | NO_CONFIG | DEACTIVATED | INVALID | NOT_REGISTERED.
  - Empty state: "No version-check events in this date range."
  - Fetches from `GET /api/admin/version-check-metrics?from=...&to=...`.
  - Delete or redirect old `/admin/metrics/` page route (see T019).
- **Files:**
  - `src/app/admin/(protected)/version-check-metrics/page.tsx` — NEW
  - `src/app/admin/(protected)/metrics/` directory — DELETE (or add redirect)
- **Dependencies:** T014
- **Acceptance criteria:** Date range filter works. Per-day rows show ACTIVE/DEACTIVE counts. Empty state shown when no data. Old `/admin/metrics` URL removed.
- **Complexity:** M

---

### T019 — Delete Old Routes and Files

- **Description:** Clean up all old/replaced routes and directories:
  - Delete `src/app/api/sensor/version-check/route.ts`
  - Delete `src/app/api/sensor/config/route.ts`
  - Delete `src/app/api/upload/route.ts`
  - Delete `src/app/api/sensor/` directory (if empty)
  - Delete `src/app/api/admin/history/[id]/approve/route.ts`
  - Delete `src/app/api/admin/history/[id]/reject/route.ts`
  - Delete `src/app/api/admin/sensors/[id]/configs/` directory and all contents
  - Delete `src/app/api/admin/configs/route.ts`
  - Delete `src/app/api/admin/metrics/route.ts`
  - Delete `src/app/api/device-requests/route.ts` (manual registration endpoint — replaced by auto-register)

  Also update nav in T014 scope: update metrics href from `/admin/metrics` to `/admin/version-check-metrics`.
- **Files:**
  - Multiple files — DELETE
  - `src/components/admin/nav-config.ts` — MODIFY (update metrics href)
- **Dependencies:** T007, T008, T009, T011, T012, T013, T014, T015, T016, T017, T018
- **Acceptance criteria:** `tsc --noEmit` → 0 errors after deletions. No references to deleted routes remain in active code.
- **Complexity:** M

---

### T020 — Tests (Update + New)

- **Description:**
  - **Update** `tests/version-check.test.ts`: update mocks to use `getActiveGlobalConfig()` instead of per-sensor config function.
  - **Update** `tests/semver.test.ts`: add test cases for `semverGt()` (at least 6 cases: equal, lower major, higher major, lower minor, higher patch, equal patch).
  - **New** `tests/global-config.test.ts`: test `uploadGlobalConfig()` (valid upload, duplicate version → error, version ≤ ACTIVE → error), `activateGlobalConfig()` (archives old, sets new ACTIVE).
  - **New** `tests/registration.test.ts`: test `autoRegisterWithToken()` (creates device, returns token, second call → duplicate error).
  - All 26 existing tests must continue to pass.
- **Files:**
  - `tests/version-check.test.ts` — MODIFY
  - `tests/semver.test.ts` — MODIFY
  - `tests/global-config.test.ts` — NEW
  - `tests/registration.test.ts` — NEW
- **Dependencies:** T003, T004, T005
- **Commands:**
  ```bash
  node --import tsx --test tests/*.test.ts
  ```
- **Acceptance criteria:** All existing tests pass. New test suites pass. Total: 30+ tests, 0 failures.
- **Complexity:** M

---

### T021 — Final Verification + README

- **Description:** Run full verification suite. Fix any remaining TypeScript errors, lint warnings, or test failures. Update `README.md`:
  - Document new env vars (remove `AUTO_REGISTER_ON_UPLOAD`).
  - Add sensor API v1 reference (`/api/v1/sensors/register`, `/api/v1/sensors/heartbeat`, `/api/v1/sensors/upload`, `/api/v1/sensors/version-check`, `/api/v1/sensors/configuration/download`).
  - Update admin workflow docs (global config management).
  - Note: old API paths (`/api/upload`, `/api/sensor/*`) are no longer available.
- **Files:**
  - `README.md` — MODIFY
  - Any files flagged by type-check or lint — MODIFY
- **Dependencies:** ALL previous tasks
- **Commands:**
  ```bash
  cmd /c node_modules\.bin\tsc --noEmit
  cmd /c node_modules\.bin\next lint
  node --import tsx --test tests/*.test.ts
  cmd /c node_modules\.bin\next build
  ```
- **Acceptance criteria:** All items in Definition of Done checked.
- **Complexity:** S

---

## Task Status Summary

| Task | Title | Complexity | Status |
|------|-------|-----------|--------|
| T001 | Schema + Migration (v3) | L | `[x]` |
| T002 | Environment Cleanup | S | `[x]` |
| T003 | semverGt() Function | S | `[x]` |
| T004 | Rewrite Sensor Config Service (Global) | L | `[x]` |
| T005 | Registration Service — autoRegisterWithToken | M | `[x]` |
| T006 | Sensor Deletion Service | M | `[x]` |
| T007 | Register Endpoint (`/api/v1/sensors/register`) | M | `[x]` |
| T008 | Admin Global Config Routes | M | `[x]` |
| T009 | Version-Check Route (v1 + global) | M | `[x]` |
| T010 | Admin Sensor Delete Route | M | `[x]` |
| T011 | Heartbeat Endpoint | M | `[x]` |
| T012 | Upload Endpoint (`/api/v1/sensors/upload`) | M | `[x]` |
| T013 | Config Download Endpoint | M | `[x]` |
| T014 | Admin Metrics Route (version-check-metrics) | M | `[x]` |
| T015 | Sensor Detail Page Update | M | `[x]` |
| T016 | Configuration Settings Page Rewrite | L | `[x]` |
| T017 | Registration History Page (Read-Only) | S | `[x]` |
| T018 | Version-Check Metrics Page | M | `[x]` |
| T019 | Delete Old Routes + Nav Update | M | `[x]` |
| T020 | Tests (Update + New) | M | `[x]` |
| T021 | Final Verification + README | S | `[x]` |

---

## Parallelizable Tasks

After T001 + T002 complete:

- **Group A** (services): T003 → T004; T005; T006 — can all start after T001
- **Group B** (UI-only): T017 — depends only on existing history API (unchanged GET)

After Group A:
- **Group C** (routes): T007, T008, T009, T010, T011, T012, T013, T014 — depend on services, not on each other

After Group C:
- **Group D** (UI): T015, T016, T018 — depend on routes

T019 (cleanup): runs after all new routes are verified
T020 (tests): runs after T003, T004, T005
T021 (verification): final, after everything

---

## Final Verification Checklist

- [x] All 14 acceptance criteria in spec.md verified
- [x] `POST /api/v1/sensors/register` → creates sensor + token
- [x] `POST /api/v1/sensors/heartbeat` → updates telemetry, DEACTIVE still 200
- [x] `POST /api/v1/sensors/upload` → bearer-authed, no auto-register
- [x] `POST /api/v1/sensors/version-check` → uses global config
- [x] `GET /api/v1/sensors/configuration/download` → streams global config + writes download event
- [x] `POST /api/admin/configuration` → global config upload with forward-version check
- [x] `POST /api/admin/configuration/[id]/activate` → atomic archive + activate
- [x] `DELETE /api/admin/sensors/[id]` → permanent deletion with audit
- [x] Old routes deleted (`/api/upload`, `/api/sensor/*`, per-sensor config routes)
- [x] History page is read-only (no approve/reject)
- [x] Metrics page at `/admin/version-check-metrics` with date range filter
- [x] Tests: all existing pass + new tests pass (33 total)
- [x] `tsc --noEmit` → 0 errors
- [x] `next lint` → 0 warnings
- [x] `next build` → succeeds
- [x] Migration applied, partial unique index on global config confirmed
- [x] README updated
