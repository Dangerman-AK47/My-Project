/*
  Warnings:

  - You are about to drop the `fv_sensor_config_storage_objects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fv_sensor_configurations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fv_sensor_config_storage_objects" DROP CONSTRAINT IF EXISTS "fv_sensor_config_storage_objects_sensorConfigurationId_fkey";

-- DropForeignKey
ALTER TABLE "fv_sensor_configurations" DROP CONSTRAINT IF EXISTS "fv_sensor_configurations_activatedByAdminId_fkey";

-- DropForeignKey
ALTER TABLE "fv_sensor_configurations" DROP CONSTRAINT IF EXISTS "fv_sensor_configurations_registeredDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "fv_sensor_configurations" DROP CONSTRAINT IF EXISTS "fv_sensor_configurations_uploadedByAdminId_fkey";

-- DropForeignKey
ALTER TABLE "fv_uploaded_file_records" DROP CONSTRAINT IF EXISTS "fv_uploaded_file_records_registeredDeviceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "fv_sensor_config_storage_objects";

-- DropTable
DROP TABLE IF EXISTS "fv_sensor_configurations";

-- Drop old partial index if exists
DROP INDEX IF EXISTS "fv_sensor_configurations_active_unique";

-- CreateTable
CREATE TABLE "fv_global_sensor_configurations" (
    "id" TEXT NOT NULL,
    "configVersion" TEXT NOT NULL,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'INACTIVE',
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedByAdminId" TEXT,
    "activatedByAdminId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fv_global_sensor_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_global_config_storage_objects" (
    "id" TEXT NOT NULL,
    "globalConfigId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_global_config_storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_sensor_config_download_events" (
    "id" TEXT NOT NULL,
    "registeredDeviceId" TEXT,
    "deviceId" TEXT NOT NULL,
    "globalConfigId" TEXT,
    "configVersion" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_sensor_config_download_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fv_global_sensor_configurations_configVersion_key" ON "fv_global_sensor_configurations"("configVersion");

-- CreateIndex
CREATE INDEX "fv_global_sensor_configurations_status_idx" ON "fv_global_sensor_configurations"("status");

-- Partial unique index: at most one ACTIVE global configuration
CREATE UNIQUE INDEX "fv_global_sensor_configurations_active_unique"
  ON "fv_global_sensor_configurations"((1))
  WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "fv_global_config_storage_objects_globalConfigId_idx" ON "fv_global_config_storage_objects"("globalConfigId");

-- CreateIndex
CREATE INDEX "fv_sensor_config_download_events_registeredDeviceId_idx" ON "fv_sensor_config_download_events"("registeredDeviceId");

-- CreateIndex
CREATE INDEX "fv_sensor_config_download_events_deviceId_idx" ON "fv_sensor_config_download_events"("deviceId");

-- CreateIndex
CREATE INDEX "fv_sensor_config_download_events_createdAt_idx" ON "fv_sensor_config_download_events"("createdAt");

-- AddForeignKey
ALTER TABLE "fv_uploaded_file_records" ADD CONSTRAINT "fv_uploaded_file_records_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_global_sensor_configurations" ADD CONSTRAINT "fv_global_sensor_configurations_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_global_sensor_configurations" ADD CONSTRAINT "fv_global_sensor_configurations_activatedByAdminId_fkey" FOREIGN KEY ("activatedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_global_config_storage_objects" ADD CONSTRAINT "fv_global_config_storage_objects_globalConfigId_fkey" FOREIGN KEY ("globalConfigId") REFERENCES "fv_global_sensor_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_sensor_config_download_events" ADD CONSTRAINT "fv_sensor_config_download_events_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_sensor_config_download_events" ADD CONSTRAINT "fv_sensor_config_download_events_globalConfigId_fkey" FOREIGN KEY ("globalConfigId") REFERENCES "fv_global_sensor_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
