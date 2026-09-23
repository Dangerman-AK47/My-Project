# Database Rules

## Technology

- PostgreSQL with Prisma ORM.
- Schema file: `prisma/schema.prisma`.
- Always run `prisma generate` after schema changes.
- Use `prisma migrate dev` in development, `prisma migrate deploy` in production.

## Table Names

All tables use the `fv_` prefix and are mapped via `@@map()`:

```text
fv_admin_accounts               — AdminAccount
fv_registered_devices           — RegisteredDevice
fv_device_registration_requests — DeviceRegistrationRequest
fv_uploaded_file_records        — UploadedFileRecord
fv_device_status_events         — DeviceStatusEvent
fv_admin_audit_events           — AdminAuditEvent
fv_upload_storage_objects       — UploadStorageObject
```

## Core Models (summary)

### AdminAccount
- `id`, `username` (unique), `passwordHash`, `role`, `isActive`
- `createdAt`, `updatedAt`, `lastLoginAt`

### RegisteredDevice
- `id`, `deviceId` (unique), `status` (ENABLED | DISABLED)
- `registeredAt`, `updatedAt`, `lastUploadAt`, `uploadCount`, `totalStorageBytes`

### DeviceRegistrationRequest
- `id`, `deviceId`, `status` (PENDING | APPROVED | REJECTED | CANCELLED)
- `submittedAt`, `reviewedAt`, `reviewedByAdminId`, `reviewReason`, `requesterMetadata`
- `pendingDeviceKey` (unique, null when not PENDING) — enforces one pending per device at DB level

### UploadedFileRecord
- `id`, `uploadRecordId` (human-readable, e.g. "UP-000042"), `sequenceNumber` (autoincrement)
- `registeredDeviceId`, `deviceId` (denormalized for audit), `originalFileName`
- `storageKey`, `mimeType`, `fileExtension`, `fileSizeBytes`, `checksum`
- `uploadStatus`, `uploadedAt`, `createdAt`, `updatedAt`

### DeviceStatusEvent
- `id`, `registeredDeviceId`, `previousStatus`, `newStatus`
- `changedByAdminId`, `reason`, `createdAt`

### AdminAuditEvent
- `id`, `adminId`, `action`, `entityType`, `entityId`
- `metadata` (JSON), `ipAddress`, `userAgent`, `createdAt`

### UploadStorageObject
- `id`, `uploadedFileRecordId`, `storageProvider`, `storageKey`, `createdAt`

## General Rules

- Use foreign keys and Prisma relations correctly.
- Use `@unique` constraints where uniqueness is required at the DB level.
- Add `@@index` for all fields used in frequent queries (status, deviceId, dates, etc).
- Use `prisma.$transaction()` for all multi-step operations:
  - Approving/rejecting registration requests
  - Updating device status (device + DeviceStatusEvent + AdminAuditEvent)
  - Recording uploads (file record + storage object + device counters + audit)
  - Deleting files (record + storage object + device counter decrement + audit)
- Keep `uploadCount` and `totalStorageBytes` accurate — increment on upload, decrement on delete.
- Use `BigInt` for `totalStorageBytes` to support large storage totals.
- Never hardcode database URLs — always use `DATABASE_URL` env var.
