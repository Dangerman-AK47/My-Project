-- Step 1: Rename DeviceStatus enum values
ALTER TYPE "DeviceStatus" RENAME VALUE 'ENABLED' TO 'ACTIVE';
ALTER TYPE "DeviceStatus" RENAME VALUE 'DISABLED' TO 'DEACTIVE';

-- Step 2: Add AUTO_APPROVED to RegistrationRequestStatus enum
ALTER TYPE "RegistrationRequestStatus" ADD VALUE 'AUTO_APPROVED';

-- Step 3: Create new enums
CREATE TYPE "ConfigurationStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "VersionCheckResult" AS ENUM ('CURRENT', 'UPDATE_AVAILABLE', 'SENSOR_DEACTIVATED', 'NO_CONFIGURATION_AVAILABLE', 'INVALID_VERSION', 'SENSOR_NOT_REGISTERED');

-- Step 4: Alter fv_registered_devices
ALTER TABLE "fv_registered_devices" ADD COLUMN "firmwareVersion" TEXT,
ADD COLUMN "firstSeenAt" TIMESTAMP(3),
ADD COLUMN "hardwareModel" TEXT,
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "metadata" JSONB,
ADD COLUMN "sensorVersion" TEXT,
ADD COLUMN "tokenHash" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Step 5: CreateTable fv_sensor_configurations
CREATE TABLE "fv_sensor_configurations" (
    "id" TEXT NOT NULL,
    "registeredDeviceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
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

    CONSTRAINT "fv_sensor_configurations_pkey" PRIMARY KEY ("id")
);

-- Step 6: CreateTable fv_sensor_config_storage_objects
CREATE TABLE "fv_sensor_config_storage_objects" (
    "id" TEXT NOT NULL,
    "sensorConfigurationId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_sensor_config_storage_objects_pkey" PRIMARY KEY ("id")
);

-- Step 7: CreateTable fv_sensor_version_check_events
CREATE TABLE "fv_sensor_version_check_events" (
    "id" TEXT NOT NULL,
    "registeredDeviceId" TEXT,
    "deviceId" TEXT NOT NULL,
    "result" "VersionCheckResult" NOT NULL,
    "reportedVersion" TEXT,
    "activeConfigVersion" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_sensor_version_check_events_pkey" PRIMARY KEY ("id")
);

-- Step 8: CreateTable fv_daily_sensor_version_check_metrics
CREATE TABLE "fv_daily_sensor_version_check_metrics" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "result" "VersionCheckResult" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fv_daily_sensor_version_check_metrics_pkey" PRIMARY KEY ("id")
);

-- Step 9: Create Indexes
CREATE INDEX "fv_sensor_configurations_registeredDeviceId_idx" ON "fv_sensor_configurations"("registeredDeviceId");
CREATE INDEX "fv_sensor_configurations_deviceId_idx" ON "fv_sensor_configurations"("deviceId");
CREATE INDEX "fv_sensor_configurations_status_idx" ON "fv_sensor_configurations"("status");
CREATE UNIQUE INDEX "fv_sensor_configurations_registeredDeviceId_configVersion_key" ON "fv_sensor_configurations"("registeredDeviceId", "configVersion");

CREATE INDEX "fv_sensor_config_storage_objects_sensorConfigurationId_idx" ON "fv_sensor_config_storage_objects"("sensorConfigurationId");

CREATE INDEX "fv_sensor_version_check_events_registeredDeviceId_idx" ON "fv_sensor_version_check_events"("registeredDeviceId");
CREATE INDEX "fv_sensor_version_check_events_deviceId_idx" ON "fv_sensor_version_check_events"("deviceId");
CREATE INDEX "fv_sensor_version_check_events_createdAt_idx" ON "fv_sensor_version_check_events"("createdAt");
CREATE INDEX "fv_sensor_version_check_events_result_idx" ON "fv_sensor_version_check_events"("result");

CREATE INDEX "fv_daily_sensor_version_check_metrics_deviceId_idx" ON "fv_daily_sensor_version_check_metrics"("deviceId");
CREATE INDEX "fv_daily_sensor_version_check_metrics_date_idx" ON "fv_daily_sensor_version_check_metrics"("date");
CREATE UNIQUE INDEX "fv_daily_sensor_version_check_metrics_deviceId_date_result_key" ON "fv_daily_sensor_version_check_metrics"("deviceId", "date", "result");

-- Step 10: Partial unique index (one ACTIVE config per sensor)
CREATE UNIQUE INDEX "fv_sensor_configurations_active_unique"
  ON "fv_sensor_configurations"("registeredDeviceId")
  WHERE "status" = 'ACTIVE';

-- Step 11: Foreign keys
ALTER TABLE "fv_sensor_configurations" ADD CONSTRAINT "fv_sensor_configurations_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fv_sensor_configurations" ADD CONSTRAINT "fv_sensor_configurations_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fv_sensor_configurations" ADD CONSTRAINT "fv_sensor_configurations_activatedByAdminId_fkey" FOREIGN KEY ("activatedByAdminId") REFERENCES "fv_admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fv_sensor_config_storage_objects" ADD CONSTRAINT "fv_sensor_config_storage_objects_sensorConfigurationId_fkey" FOREIGN KEY ("sensorConfigurationId") REFERENCES "fv_sensor_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fv_sensor_version_check_events" ADD CONSTRAINT "fv_sensor_version_check_events_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "fv_registered_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
