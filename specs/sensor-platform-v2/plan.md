# Implementation Plan: Sensor Platform v3 — Global Config, API v1, Auto-Register

## Status

DRAFT — AWAITING USER APPROVAL

## References

- RnA: `rna.md`
- Specification: `spec.md`

---

## Design Summary

The upgrade is applied in six sequential phases:

1. **DB Migration** — Drop per-sensor config tables (`fv_sensor_configurations`, `fv_sensor_config_storage_objects`). Create three new tables (`fv_global_sensor_configurations`, `fv_global_config_storage_objects`, `fv_sensor_config_download_events`). Add partial unique index for global ACTIVE config. Remove `AUTO_REGISTER_ON_UPLOAD` env var usage.

2. **Service Layer** — Rewrite `sensor-configs.ts` for global config logic. Add semver `>` comparison. Add `autoRegisterWithToken()` function. Add heartbeat update logic. Add config download event recording.

3. **API Route Layer** — Create `/api/v1/sensors/*` routes (register, heartbeat, upload, version-check, configuration/download). Delete old `/api/sensor/*` and `/api/upload` routes. Add `DELETE /api/admin/sensors/[id]`. Add `/api/admin/configuration` routes. Add `/api/admin/version-check-metrics`. Delete admin per-sensor config routes. Delete approve/reject history routes. Delete admin token-issue route.

4. **Admin UI Layer** — Update sensor detail page (remove per-sensor config section, remove issue-token, add delete). Update Configuration Settings page for global config. Make Registration History page read-only. Add delete confirmation modal. Update metrics page to new URL and new data shape. Update nav href for metrics.

5. **Tests** — Update/add unit tests for new global config service, register endpoint, heartbeat. Fix existing tests if affected.

6. **Verification** — TypeScript, lint, build, test suite.

---

## Architecture

```
Sensor Device (first time)
  └── POST /api/v1/sensors/register  →  autoRegisterWithToken()  →  Prisma (transaction) → token in response

Sensor Device (ongoing)
  ├── POST /api/v1/sensors/heartbeat            →  requireSensorAuth()  →  updateHeartbeat()  →  Prisma
  ├── POST /api/v1/sensors/upload               →  requireSensorAuth()  →  recordUpload()     →  Prisma + StorageDriver
  ├── POST /api/v1/sensors/version-check        →  requireSensorAuth()  →  performVersionCheck() →  Prisma (global config)
  └── GET  /api/v1/sensors/configuration/download →  requireSensorAuth()  →  globalConfigService  →  StorageDriver + Prisma (download event)

Admin Browser (cookie session)
  ├── /api/admin/sensors/*            →  getAuthorizedAdmin()  →  sensorService / deviceQueries  →  Prisma
  ├── DELETE /api/admin/sensors/[id]  →  getAuthorizedAdmin()  →  deleteSensor()                 →  Prisma (transaction)
  ├── /api/admin/configuration        →  getAuthorizedAdmin()  →  globalConfigService             →  StorageDriver + Prisma
  ├── /api/admin/version-check-metrics →  getAuthorizedAdmin()  →  metricsService                →  Prisma (join)
  └── /api/admin/audit                →  getAuthorizedAdmin()  →  auditService                   →  Prisma
```

---

## Components and Modules

### Phase 1 — Database Migration

| File | New/Modified | Purpose |
|------|-------------|---------|
| `prisma/schema.prisma` | **MODIFIED** | Drop per-sensor config models; add 3 new models; update `AdminAccount` and `RegisteredDevice` relations |
| `prisma/migrations/<ts>_sensor_platform_v3/migration.sql` | **NEW** | Drop old tables + create new tables + partial unique index for global config |
| `prisma/seed.ts` | **MODIFIED** | Remove any seed data referencing `SensorConfiguration`; add optional global config seed |

### Phase 2 — Environment

| File | New/Modified | Purpose |
|------|-------------|---------|
| `src/lib/env.ts` | **MODIFIED** | Remove `AUTO_REGISTER_ON_UPLOAD` from Zod schema |
| `.env` | **MODIFIED** | Remove `AUTO_REGISTER_ON_UPLOAD` line |
| `.env.example` | **MODIFIED** | Remove `AUTO_REGISTER_ON_UPLOAD` line |

### Phase 3 — Service Layer

| File | New/Modified | Purpose |
|------|-------------|---------|
| `src/lib/services/sensor-configs.ts` | **REWRITE** | New global config functions: `uploadGlobalConfig()`, `activateGlobalConfig()`, `listGlobalConfigs()`, `getActiveGlobalConfig()`. Semver `>` validation. Removes all per-sensor logic. |
| `src/lib/services/registration-requests.ts` | **MODIFIED** | Add `autoRegisterWithToken()` — creates device + request + token in one transaction. Remove or deprecate the old `autoRegisterSensor()` (which didn't issue a token). |
| `src/lib/services/version-check.ts` | **MODIFIED** | Update `performVersionCheck()` to use `getActiveGlobalConfig()` instead of per-sensor config lookup. |
| `src/lib/services/devices.ts` | **MODIFIED** | Add `deleteSensor(deviceId, adminId)` — transaction: revoke token + audit + delete device. |
| `src/lib/validation/semver.ts` | **MODIFIED** | Add `semverGt(a: string, b: string): boolean` — returns true if `a > b` as semver. |
| `src/lib/services/sensor-configs.ts` | New file replaces old | See above |

### Phase 4 — API Route Layer

#### New Sensor Routes (`/api/v1/sensors/`)

| File | Status | Purpose |
|------|--------|---------|
| `src/app/api/v1/sensors/register/route.ts` | **NEW** | `POST /api/v1/sensors/register` |
| `src/app/api/v1/sensors/heartbeat/route.ts` | **NEW** | `POST /api/v1/sensors/heartbeat` |
| `src/app/api/v1/sensors/upload/route.ts` | **NEW** | `POST /api/v1/sensors/upload` (bearer-authed, no auto-register) |
| `src/app/api/v1/sensors/version-check/route.ts` | **NEW** | `POST /api/v1/sensors/version-check` |
| `src/app/api/v1/sensors/configuration/download/route.ts` | **NEW** | `GET /api/v1/sensors/configuration/download` |

#### Deleted Sensor Routes

| File | Status |
|------|--------|
| `src/app/api/sensor/version-check/route.ts` | **DELETE** |
| `src/app/api/sensor/config/route.ts` | **DELETE** |
| `src/app/api/upload/route.ts` | **DELETE** |

#### New Admin Routes

| File | Status | Purpose |
|------|--------|---------|
| `src/app/api/admin/configuration/route.ts` | **NEW** | `GET` list global configs + `POST` upload global config |
| `src/app/api/admin/configuration/[id]/activate/route.ts` | **NEW** | `POST` activate global config |
| `src/app/api/admin/sensors/[id]/route.ts` | **MODIFIED** | Add `DELETE` handler for sensor deletion |
| `src/app/api/admin/version-check-metrics/route.ts` | **NEW** | `GET /api/admin/version-check-metrics` (replaces metrics) |

#### Deleted Admin Routes

| File | Status | Reason |
|------|--------|--------|
| `src/app/api/admin/sensors/[id]/token/route.ts` | **MODIFIED** (DELETE POST handler only, keep if DELETE method is already there) | Remove `POST` (token issue); keep `DELETE` (token revoke) OR rename file to be explicit |
| `src/app/api/admin/history/[id]/approve/route.ts` | **DELETE** | Manual approval removed |
| `src/app/api/admin/history/[id]/reject/route.ts` | **DELETE** | Manual rejection removed |
| `src/app/api/admin/sensors/[id]/configs/route.ts` | **DELETE** | Per-sensor config removed |
| `src/app/api/admin/sensors/[id]/configs/[configId]/activate/route.ts` | **DELETE** | Per-sensor config removed |
| `src/app/api/admin/configs/route.ts` | **DELETE** | Replaced by `/api/admin/configuration` |
| `src/app/api/admin/metrics/route.ts` | **DELETE** | Replaced by `/api/admin/version-check-metrics` |

### Phase 5 — Admin UI

| File | Status | Purpose |
|------|--------|---------|
| `src/components/admin/nav-config.ts` | **MODIFIED** | Update metrics href from `/admin/metrics` to `/admin/version-check-metrics` |
| `src/app/admin/(protected)/sensors/[id]/page.tsx` | **MODIFIED** | Remove per-sensor config section; remove Issue Token button; add Revoke Token button; add Delete Sensor button with confirmation modal |
| `src/app/admin/(protected)/configs/page.tsx` | **REWRITE** | Show global config list (not per-sensor). Upload form with version + file. Activate button. Forward-version validation message. |
| `src/app/admin/(protected)/history/page.tsx` | **MODIFIED** | Remove approve/reject buttons. Show read-only history. |
| `src/app/admin/(protected)/metrics/` | **DELETE** | Replaced by `version-check-metrics/` |
| `src/app/admin/(protected)/version-check-metrics/page.tsx` | **NEW** | New metrics page with date range filter, ACTIVE/DEACTIVE counts, unique sensor counts |

---

## Data Model Changes

### Migration SQL Structure

The single migration `<ts>_sensor_platform_v3` contains:

```sql
-- Step 1: Drop per-sensor config tables (in correct FK order)
DROP TABLE IF EXISTS "fv_sensor_config_storage_objects";
DROP TABLE IF EXISTS "fv_sensor_configurations";

-- Step 2: Drop the partial unique index if it exists from v2
DROP INDEX IF EXISTS "fv_sensor_configurations_active_unique";

-- Step 3: Create new global config table
CREATE TABLE "fv_global_sensor_configurations" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "configVersion"       TEXT NOT NULL,
  "status"              "ConfigurationStatus" NOT NULL DEFAULT 'INACTIVE',
  "originalFileName"    TEXT NOT NULL,
  "storageKey"          TEXT NOT NULL,
  "mimeType"            TEXT NOT NULL,
  "fileSizeBytes"       INTEGER NOT NULL,
  "checksum"            TEXT,
  "uploadedByAdminId"   TEXT,
  "activatedByAdminId"  TEXT,
  "activatedAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);

-- Unique version strings (no duplicates)
CREATE UNIQUE INDEX "fv_global_sensor_configurations_version_key"
  ON "fv_global_sensor_configurations"("configVersion");

-- Partial unique index: at most one ACTIVE global config
CREATE UNIQUE INDEX "fv_global_sensor_configurations_active_unique"
  ON "fv_global_sensor_configurations"((1))
  WHERE "status" = 'ACTIVE';

-- FK constraints
ALTER TABLE "fv_global_sensor_configurations"
  ADD CONSTRAINT "fv_global_sensor_configurations_uploadedByAdminId_fkey"
  FOREIGN KEY ("uploadedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL;

ALTER TABLE "fv_global_sensor_configurations"
  ADD CONSTRAINT "fv_global_sensor_configurations_activatedByAdminId_fkey"
  FOREIGN KEY ("activatedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL;

-- Step 4: Create global config storage objects table
CREATE TABLE "fv_global_config_storage_objects" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "globalConfigId"  TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'local',
  "storageKey"      TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "fv_global_config_storage_objects_globalConfigId_idx"
  ON "fv_global_config_storage_objects"("globalConfigId");

ALTER TABLE "fv_global_config_storage_objects"
  ADD CONSTRAINT "fv_global_config_storage_objects_globalConfigId_fkey"
  FOREIGN KEY ("globalConfigId") REFERENCES "fv_global_sensor_configurations"("id") ON DELETE CASCADE;

-- Step 5: Create config download events table
CREATE TABLE "fv_sensor_config_download_events" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "registeredDeviceId"  TEXT,
  "deviceId"            TEXT NOT NULL,
  "globalConfigId"      TEXT,
  "configVersion"       TEXT,
  "ipAddress"           TEXT,
  "userAgent"           TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "fv_sensor_config_download_events_registeredDeviceId_idx"
  ON "fv_sensor_config_download_events"("registeredDeviceId");
CREATE INDEX "fv_sensor_config_download_events_deviceId_idx"
  ON "fv_sensor_config_download_events"("deviceId");
CREATE INDEX "fv_sensor_config_download_events_createdAt_idx"
  ON "fv_sensor_config_download_events"("createdAt");

ALTER TABLE "fv_sensor_config_download_events"
  ADD CONSTRAINT "fv_sensor_config_download_events_registeredDeviceId_fkey"
  FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE SET NULL;

ALTER TABLE "fv_sensor_config_download_events"
  ADD CONSTRAINT "fv_sensor_config_download_events_globalConfigId_fkey"
  FOREIGN KEY ("globalConfigId") REFERENCES "fv_global_sensor_configurations"("id") ON DELETE SET NULL;
```

### Updated Prisma Schema Models

#### New model: `GlobalSensorConfiguration`

```prisma
model GlobalSensorConfiguration {
  id                 String              @id @default(cuid())
  configVersion      String              @unique
  status             ConfigurationStatus @default(INACTIVE)
  originalFileName   String
  storageKey         String
  mimeType           String
  fileSizeBytes      Int
  checksum           String?
  uploadedByAdminId  String?
  uploadedByAdmin    AdminAccount?       @relation("GlobalConfigUploadedBy", fields: [uploadedByAdminId], references: [id], onDelete: SetNull)
  activatedByAdminId String?
  activatedByAdmin   AdminAccount?       @relation("GlobalConfigActivatedBy", fields: [activatedByAdminId], references: [id], onDelete: SetNull)
  activatedAt        DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  storageObjects     GlobalConfigStorageObject[]
  downloadEvents     SensorConfigDownloadEvent[]

  @@index([status])
  @@map("fv_global_sensor_configurations")
}
// Partial unique index added via raw SQL in migration:
// CREATE UNIQUE INDEX "fv_global_sensor_configurations_active_unique"
//   ON "fv_global_sensor_configurations"((1)) WHERE status = 'ACTIVE';
```

#### New model: `GlobalConfigStorageObject`

```prisma
model GlobalConfigStorageObject {
  id             String                    @id @default(cuid())
  globalConfigId String
  globalConfig   GlobalSensorConfiguration @relation(fields: [globalConfigId], references: [id], onDelete: Cascade)
  storageProvider String                   @default("local")
  storageKey     String
  createdAt      DateTime                  @default(now())

  @@index([globalConfigId])
  @@map("fv_global_config_storage_objects")
}
```

#### New model: `SensorConfigDownloadEvent`

```prisma
model SensorConfigDownloadEvent {
  id                  String                     @id @default(cuid())
  registeredDeviceId  String?
  registeredDevice    RegisteredDevice?          @relation(fields: [registeredDeviceId], references: [id], onDelete: SetNull)
  deviceId            String
  globalConfigId      String?
  globalConfig        GlobalSensorConfiguration? @relation(fields: [globalConfigId], references: [id], onDelete: SetNull)
  configVersion       String?
  ipAddress           String?
  userAgent           String?
  createdAt           DateTime                   @default(now())

  @@index([registeredDeviceId])
  @@index([deviceId])
  @@index([createdAt])
  @@map("fv_sensor_config_download_events")
}
```

#### Modified: `RegisteredDevice`

Remove `configurations SensorConfiguration[]` relation.
Add `configDownloads SensorConfigDownloadEvent[]` relation.

#### Modified: `AdminAccount`

Remove `uploadedConfigs SensorConfiguration[] @relation("ConfigUploadedBy")`.
Remove `activatedConfigs SensorConfiguration[] @relation("ConfigActivatedBy")`.
Add `uploadedGlobalConfigs GlobalSensorConfiguration[] @relation("GlobalConfigUploadedBy")`.
Add `activatedGlobalConfigs GlobalSensorConfiguration[] @relation("GlobalConfigActivatedBy")`.

#### Deleted models (from schema):

- `SensorConfiguration`
- `SensorConfigStorageObject`

---

## Service Layer Design

### `src/lib/services/sensor-configs.ts` (Complete Rewrite)

```typescript
// Functions:
uploadGlobalConfig(input: {
  file: Buffer;
  originalFileName: string;
  mimeType: string;
  configVersion: string;  // must pass semverSchema + semverGt check vs active
  adminId: string;
}): Promise<GlobalSensorConfiguration>

activateGlobalConfig(configId: string, adminId: string): Promise<{
  activated: GlobalSensorConfiguration;
  archived: GlobalSensorConfiguration | null;
}>

listGlobalConfigs(): Promise<GlobalSensorConfiguration[]>

getActiveGlobalConfig(): Promise<GlobalSensorConfiguration | null>

// Error classes:
GlobalConfigNotFoundError
GlobalConfigVersionConflictError   // duplicate version
GlobalConfigVersionNotForwardError // version ≤ current ACTIVE
```

### `src/lib/validation/semver.ts` (Addition)

```typescript
// Add:
export function semverGt(a: string, b: string): boolean
// Parses "major.minor.patch" from both strings, compares as integer tuples.
// Returns true if a > b.
```

### `src/lib/services/registration-requests.ts` (Modified)

```typescript
// New function:
autoRegisterWithToken(deviceId: string): Promise<{ token: string; device: RegisteredDevice }>
// Creates RegisteredDevice + DeviceRegistrationRequest[AUTO_APPROVED] + issues token
// Returns plain-text token (hashed in DB)
// Throws DuplicateRegistrationError if deviceId already exists

// Remove: autoRegisterSensor() (old function that didn't issue token)
```

### `src/lib/services/devices.ts` (Addition)

```typescript
// New function:
deleteSensor(deviceId: string, adminId: string): Promise<void>
// Transaction: revoke tokenHash → write SENSOR_DELETED audit → delete RegisteredDevice
// Throws DeviceNotFoundError if sensor doesn't exist
```

### `src/lib/services/version-check.ts` (Modified)

```typescript
// Change: replace getActiveSensorConfig(registeredDeviceId) with getActiveGlobalConfig()
// No sensor FK in config lookup
```

---

## API Route Implementation Notes

### `POST /api/v1/sensors/register`

```typescript
export const runtime = "nodejs";

// 1. Parse + validate body: { sensorId }
// 2. Call autoRegisterWithToken(sensorId)
// 3. Return 201 { sensorId, token }
// Error map:
//   DuplicateRegistrationError → 409 already_registered
//   ZodError → 400 validation_error
```

### `POST /api/v1/sensors/heartbeat`

```typescript
export const runtime = "nodejs";

// 1. requireSensorAuth(request) → device
// 2. Parse body: { sensorId, sensorVersion?, firmwareVersion?, hardwareModel?, metadata? }
// 3. Cross-validate: body.sensorId === device.deviceId → else 401
// 4. prisma.registeredDevice.update({ where: { id: device.id }, data: { lastSeenAt, sensorVersion, ... } })
// 5. Return 200 { status: "ok", serverTime: new Date().toISOString() }
```

### `POST /api/v1/sensors/upload`

```typescript
export const runtime = "nodejs";

// 1. requireSensorAuth(request) → device
// 2. Check device.status === "ACTIVE" → else 403 sensor_deactivated
// 3. Parse multipart: file + deviceId (for compat, but use authenticated device.deviceId)
// 4. Call recordUpload(device, file) — existing service, unchanged
// 5. Return 200 upload success response
// Note: No auto-registration. If no valid token → 401.
```

### `GET /api/v1/sensors/configuration/download`

```typescript
export const runtime = "nodejs";

// 1. requireSensorAuth(request) → device
// 2. Check device.status === "ACTIVE" → else 403 sensor_deactivated
// 3. getActiveGlobalConfig() → null → 404 no_configuration
// 4. StorageDriver.read(config.storageKey) → stream
// 5. Write SensorConfigDownloadEvent row (fire-and-forget or awaited — recommended: awaited for data integrity)
// 6. Stream response with Content-Type + Content-Disposition
```

### `DELETE /api/admin/sensors/[id]`

```typescript
// 1. getAuthorizedAdmin()
// 2. deleteSensor(deviceId, admin.id)
// 3. Return 200 { deleted: true }
// Error map: DeviceNotFoundError → 404
```

### `GET /api/admin/version-check-metrics`

```typescript
// 1. getAuthorizedAdmin()
// 2. Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 7 days)
// 3. Query:
//   const events = await prisma.sensorVersionCheckEvent.findMany({
//     where: { createdAt: { gte: fromDate, lte: toDate } },
//     include: { registeredDevice: { select: { status: true } } }
//   });
// 4. Group by date (UTC midnight), count ACTIVE vs DEACTIVE, unique deviceIds, result breakdown
// 5. Return dailySummary[]
```

---

## Validation Strategy

| Layer | Tool | What's Validated |
|-------|------|-----------------|
| Route input | Zod | `sensorId` (existing deviceId schema), `configVersion` (semverSchema), file presence, file size |
| Semver forward-only | `semverGt()` | New config version must be > current ACTIVE version |
| Duplicate version | DB unique index on `configVersion` | Prevents duplicate version strings |
| Global ACTIVE unique | DB partial unique index | At most one ACTIVE global config |
| Bearer token | `requireSensorAuth()` | bcrypt compare, device lookup |
| Sensor ID cross-check | Heartbeat route | body.sensorId === authenticated device.deviceId |

---

## Authentication and Authorization

| Route | Auth Type | Guard |
|-------|-----------|-------|
| `POST /api/v1/sensors/register` | None (public) | No auth |
| `POST /api/v1/sensors/heartbeat` | Sensor bearer token | `requireSensorAuth()` |
| `POST /api/v1/sensors/upload` | Sensor bearer token | `requireSensorAuth()` |
| `POST /api/v1/sensors/version-check` | Sensor bearer token | `requireSensorAuth()` |
| `GET /api/v1/sensors/configuration/download` | Sensor bearer token | `requireSensorAuth()` |
| `GET/POST /api/admin/configuration` | Admin cookie session | `getAuthorizedAdmin()` |
| `POST /api/admin/configuration/[id]/activate` | Admin cookie session | `getAuthorizedAdmin()` |
| `DELETE /api/admin/sensors/[id]` | Admin cookie session | `getAuthorizedAdmin()` |
| `GET /api/admin/version-check-metrics` | Admin cookie session | `getAuthorizedAdmin()` |

> [!IMPORTANT]
> `/api/v1/sensors/*` routes are NOT in the Edge middleware matcher. The existing matcher covers only `/admin/:path*` and `/api/admin/:path*`. Sensor auth is done in Node runtime within each route handler. No middleware changes needed.

---

## Error Handling

Same pattern as v2 — typed error classes from services, caught in route handlers, mapped to HTTP status codes. Generic catch always returns `500 { status: "error", message: "Something went wrong." }`.

New error classes:

| Class | Thrown By | HTTP Status |
|-------|-----------|------------|
| `DuplicateRegistrationError` | `autoRegisterWithToken()` | 409 |
| `GlobalConfigVersionConflictError` | `uploadGlobalConfig()` | 409 |
| `GlobalConfigVersionNotForwardError` | `uploadGlobalConfig()` | 409 |
| `GlobalConfigNotFoundError` | `activateGlobalConfig()` | 404 |
| `SensorDeleteError` | `deleteSensor()` | 500 |

---

## Storage

Config files: same `StorageDriver` abstraction. Path prefix `configs/` (unchanged). Storage key generation uses the existing `generateStorageKey()` pattern.

---

## Implementation Sequence

### Phase 1 — Schema + Migration (T001)

Unblocks everything. `prisma generate` must succeed before any app code changes.

### Phase 2 — Environment (T002)

Remove `AUTO_REGISTER_ON_UPLOAD` from env schema and `.env` files.

### Phase 3 — Service Layer (T003–T006)

Update `semver.ts` (T003), rewrite `sensor-configs.ts` (T004), update `registration-requests.ts` (T005), update `devices.ts` (T006). Update `version-check.ts` (T006).

### Phase 4 — API Routes (T007–T013)

New v1 sensor routes (T007), updated admin routes (T008–T011), delete old routes (T012), update upload route (T013).

### Phase 5 — Admin UI (T014–T018)

Update nav (T014), update sensor detail page (T015), rewrite configs page (T016), update history page (T017), new metrics page (T018).

### Phase 6 — Tests + Verification (T019–T020)

Update existing tests if affected, add new tests, run full verification suite.

---

## Testing Strategy

### Unit Tests to Update

| Test File | Change |
|-----------|--------|
| `tests/version-check.test.ts` | Update mocks: `getActiveSensorConfig()` → `getActiveGlobalConfig()` |
| `tests/semver.test.ts` | Add tests for `semverGt()` function |
| `tests/sensor-tokens.test.ts` | No change needed |

### New Unit Tests

| Test File | Functions |
|-----------|-----------|
| `tests/global-config.test.ts` | `uploadGlobalConfig()` — semver validation, forward-only check, duplicate check; `activateGlobalConfig()` — archive old, activate new |
| `tests/registration.test.ts` | `autoRegisterWithToken()` — creates device, issues token, handles duplicate |
| `tests/semver-gt.test.ts` | `semverGt()` — all comparison combinations |

### Verification Commands

```bash
# Type check
cmd /c node_modules\.bin\tsc --noEmit

# Lint
cmd /c node_modules\.bin\next lint

# Tests
node --import tsx --test tests/*.test.ts

# Build
cmd /c node_modules\.bin\next build

# DB: generate Prisma client
cmd /c node_modules\.bin\prisma generate

# DB: apply migration
cmd /c node_modules\.bin\prisma migrate dev

# DB: re-seed
node --import tsx prisma/seed.ts
```

---

## Migration Strategy

This is a **destructive migration** for the per-sensor config tables. Since the project is local dev only with test/seed data, this is acceptable.

### Migration Workflow

```
1. Edit prisma/schema.prisma:
   - Remove SensorConfiguration model
   - Remove SensorConfigStorageObject model
   - Add GlobalSensorConfiguration model
   - Add GlobalConfigStorageObject model
   - Add SensorConfigDownloadEvent model
   - Update AdminAccount relations
   - Update RegisteredDevice relations

2. Run: cmd /c node_modules\.bin\prisma migrate dev --name sensor_platform_v3 --create-only
   (Prisma generates a migration that drops the old tables and creates new ones)

3. Manually edit the generated migration.sql:
   - Ensure DROP TABLE statements come FIRST (before CREATE TABLE)
   - Append the partial unique index SQL at the bottom:
     CREATE UNIQUE INDEX "fv_global_sensor_configurations_active_unique"
       ON "fv_global_sensor_configurations"((1)) WHERE "status" = 'ACTIVE';

4. Run: cmd /c node_modules\.bin\prisma migrate dev
5. Run: cmd /c node_modules\.bin\prisma generate
6. Update seed.ts
7. Run: node --import tsx prisma/seed.ts
```

### Rollback

Local dev only:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```
Then re-run `prisma migrate deploy`.

---

## Performance Considerations

- **Version-check metrics query**: joins `SensorVersionCheckEvent` with `RegisteredDevice` at query time. Index on `SensorVersionCheckEvent.createdAt` already exists. Index on `RegisteredDevice.status` already exists. For typical sensor fleets (< 1000 sensors), this is fast.
- **Global config lookup**: single row with `status = 'ACTIVE'` — O(1) with partial index.
- **Config download event write**: awaited (not fire-and-forget) to ensure data integrity. Small overhead (~5ms DB write) acceptable.

---

## Security Review Checklist

- [ ] Sensor tokens: `crypto.randomBytes(32)` — CSPRNG, not `Math.random()`
- [ ] Token stored as bcrypt hash (cost 12) — never plaintext in DB
- [ ] Plain-text token returned only once, in the register response body
- [ ] `Authorization` header value never written to any log
- [ ] Config file storage key uses CSPRNG — paths cannot be enumerated
- [ ] All sensor routes: `export const runtime = "nodejs"`
- [ ] `POST /api/v1/sensors/register` is public — rate-limit consideration documented (out of scope for v3)
- [ ] Sensor deletion is permanent — audit event written before delete
- [ ] Global config version forward-only validation prevents rollback attacks
- [ ] No internal DB or filesystem error details leaked to sensor responses

---

## Definition of Done

- [ ] All 14 acceptance criteria in spec.md verified
- [ ] Old sensor routes deleted (`/api/sensor/*`, `/api/upload`)
- [ ] Old per-sensor config admin routes deleted
- [ ] New `/api/v1/sensors/*` routes functional
- [ ] Global config management functional (upload, activate, list)
- [ ] Sensor deletion functional with confirmation UI
- [ ] Registration history page read-only
- [ ] Version-check metrics page at `/admin/version-check-metrics` functional with date range filter
- [ ] TypeScript: `tsc --noEmit` → 0 errors
- [ ] ESLint: `next lint` → 0 warnings
- [ ] Tests: all existing tests pass + new tests pass
- [ ] Production build: `next build` → succeeds
- [ ] Migration applied: `prisma migrate status` → all applied
- [ ] Global config partial unique index confirmed in DB
- [ ] README updated
