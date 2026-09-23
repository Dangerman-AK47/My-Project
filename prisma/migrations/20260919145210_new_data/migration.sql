-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'STORED', 'FAILED');

-- CreateTable
CREATE TABLE "fv_admin_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "fv_admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_registered_devices" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ENABLED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUploadAt" TIMESTAMP(3),
    "uploadCount" INTEGER NOT NULL DEFAULT 0,
    "totalStorageBytes" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "fv_registered_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_device_registration_requests" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "requesterMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedByAdminId" TEXT,
    "pendingDeviceKey" TEXT,

    CONSTRAINT "fv_device_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_uploaded_file_records" (
    "id" TEXT NOT NULL,
    "uploadRecordId" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "registeredDeviceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'STORED',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fv_uploaded_file_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_upload_storage_objects" (
    "id" TEXT NOT NULL,
    "uploadedFileRecordId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_upload_storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_device_status_events" (
    "id" TEXT NOT NULL,
    "registeredDeviceId" TEXT NOT NULL,
    "previousStatus" "DeviceStatus",
    "newStatus" "DeviceStatus" NOT NULL,
    "changedByAdminId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_device_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_admin_audit_events" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fv_admin_accounts_username_key" ON "fv_admin_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "fv_registered_devices_deviceId_key" ON "fv_registered_devices"("deviceId");

-- CreateIndex
CREATE INDEX "fv_registered_devices_status_idx" ON "fv_registered_devices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fv_device_registration_requests_pendingDeviceKey_key" ON "fv_device_registration_requests"("pendingDeviceKey");

-- CreateIndex
CREATE INDEX "fv_device_registration_requests_deviceId_idx" ON "fv_device_registration_requests"("deviceId");

-- CreateIndex
CREATE INDEX "fv_device_registration_requests_status_idx" ON "fv_device_registration_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fv_uploaded_file_records_uploadRecordId_key" ON "fv_uploaded_file_records"("uploadRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "fv_uploaded_file_records_sequenceNumber_key" ON "fv_uploaded_file_records"("sequenceNumber");

-- CreateIndex
CREATE INDEX "fv_uploaded_file_records_registeredDeviceId_idx" ON "fv_uploaded_file_records"("registeredDeviceId");

-- CreateIndex
CREATE INDEX "fv_uploaded_file_records_deviceId_idx" ON "fv_uploaded_file_records"("deviceId");

-- CreateIndex
CREATE INDEX "fv_uploaded_file_records_uploadedAt_idx" ON "fv_uploaded_file_records"("uploadedAt");

-- CreateIndex
CREATE INDEX "fv_uploaded_file_records_uploadStatus_idx" ON "fv_uploaded_file_records"("uploadStatus");

-- CreateIndex
CREATE INDEX "fv_uploaded_file_records_mimeType_idx" ON "fv_uploaded_file_records"("mimeType");

-- CreateIndex
CREATE INDEX "fv_upload_storage_objects_uploadedFileRecordId_idx" ON "fv_upload_storage_objects"("uploadedFileRecordId");

-- CreateIndex
CREATE INDEX "fv_device_status_events_registeredDeviceId_idx" ON "fv_device_status_events"("registeredDeviceId");

-- CreateIndex
CREATE INDEX "fv_admin_audit_events_createdAt_idx" ON "fv_admin_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "fv_admin_audit_events_entityType_entityId_idx" ON "fv_admin_audit_events"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "fv_device_registration_requests" ADD CONSTRAINT "fv_device_registration_requests_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_uploaded_file_records" ADD CONSTRAINT "fv_uploaded_file_records_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_upload_storage_objects" ADD CONSTRAINT "fv_upload_storage_objects_uploadedFileRecordId_fkey" FOREIGN KEY ("uploadedFileRecordId") REFERENCES "fv_uploaded_file_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_device_status_events" ADD CONSTRAINT "fv_device_status_events_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_device_status_events" ADD CONSTRAINT "fv_device_status_events_changedByAdminId_fkey" FOREIGN KEY ("changedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_admin_audit_events" ADD CONSTRAINT "fv_admin_audit_events_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
