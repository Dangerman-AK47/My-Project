import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAuditEvent } from "@/lib/audit";
import { getStorageDriver, sanitizeFileName, getMaxUploadBytes } from "@/lib/storage";
import { semverSchema, semverGt } from "@/lib/validation/semver";

export class GlobalConfigNotFoundError extends Error {
  constructor(id: string) {
    super(`Global sensor configuration "${id}" was not found.`);
    this.name = "GlobalConfigNotFoundError";
  }
}

export class GlobalConfigVersionConflictError extends Error {
  constructor(version: string) {
    super(`Configuration version "${version}" already exists.`);
    this.name = "GlobalConfigVersionConflictError";
  }
}

export class GlobalConfigVersionNotForwardError extends Error {
  constructor(newVersion: string, activeVersion: string) {
    super(
      `New version "${newVersion}" must be strictly greater than current active version "${activeVersion}".`
    );
    this.name = "GlobalConfigVersionNotForwardError";
  }
}

export class GlobalConfigFileTooLargeError extends Error {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      `Configuration file size (${sizeBytes} bytes) exceeds maximum limit (${maxBytes} bytes).`
    );
    this.name = "GlobalConfigFileTooLargeError";
  }
}

// Backward-compatible aliases
export const ConfigNotFoundError = GlobalConfigNotFoundError;
export const ConfigVersionConflictError = GlobalConfigVersionConflictError;
export const ConfigFileTooLargeError = GlobalConfigFileTooLargeError;

export interface UploadGlobalConfigInput {
  configVersion: string;
  originalFileName: string;
  buffer: Buffer;
  mimeType?: string;
  adminId: string;
}

/**
 * Uploads a new global configuration file.
 * Requires strict semver format, uniqueness, and must be strictly greater than
 * any currently ACTIVE configuration version.
 * The configuration is created with status "INACTIVE" until explicitly activated.
 */
export async function uploadGlobalConfig(input: UploadGlobalConfigInput) {
  // 1. Validate semver
  const parsedVersion = semverSchema.safeParse(input.configVersion);
  if (!parsedVersion.success) {
    throw new Error(parsedVersion.error.issues[0]?.message || "Invalid semver format.");
  }
  const configVersion = parsedVersion.data;

  // 2. Validate file size
  const maxBytes = getMaxUploadBytes();
  if (input.buffer.byteLength > maxBytes) {
    throw new GlobalConfigFileTooLargeError(input.buffer.byteLength, maxBytes);
  }

  // 3. Check version uniqueness
  const existing = await prisma.globalSensorConfiguration.findUnique({
    where: { configVersion },
  });
  if (existing) {
    throw new GlobalConfigVersionConflictError(configVersion);
  }

  // 4. Verify forward-only versioning against currently ACTIVE config
  const currentActive = await prisma.globalSensorConfiguration.findFirst({
    where: { status: "ACTIVE" },
  });
  if (currentActive && !semverGt(configVersion, currentActive.configVersion)) {
    throw new GlobalConfigVersionNotForwardError(configVersion, currentActive.configVersion);
  }

  // 5. Save config file via StorageDriver
  const cleanName = sanitizeFileName(input.originalFileName || "config.json");
  const driver = getStorageDriver();
  const saved = await driver.save({ originalFileName: cleanName, buffer: input.buffer });

  // 6. Store in database with transaction
  return prisma.$transaction(async (tx) => {
    const config = await tx.globalSensorConfiguration.create({
      data: {
        configVersion,
        status: "INACTIVE",
        originalFileName: cleanName,
        storageKey: saved.storagePath,
        mimeType: input.mimeType || "application/json",
        fileSizeBytes: saved.fileSize,
        checksum: saved.checksumSha256,
        uploadedByAdminId: input.adminId,
      },
    });

    await tx.globalConfigStorageObject.create({
      data: {
        globalConfigId: config.id,
        storageProvider: getEnv().UPLOAD_STORAGE_PROVIDER,
        storageKey: saved.storagePath,
      },
    });

    await recordAuditEvent(
      {
        adminId: input.adminId,
        action: "GLOBAL_CONFIG_UPLOADED",
        entityType: "GlobalSensorConfiguration",
        entityId: config.id,
        metadata: {
          configVersion,
          originalFileName: cleanName,
          fileSizeBytes: saved.fileSize,
        },
      },
      tx
    );

    return config;
  });
}

/**
 * Activates a global configuration version.
 * Sets any existing ACTIVE global configuration to ARCHIVED,
 * and sets the target configuration to ACTIVE atomically.
 */
export async function activateGlobalConfig(configId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.globalSensorConfiguration.findUnique({
      where: { id: configId },
    });
    if (!target) {
      throw new GlobalConfigNotFoundError(configId);
    }

    if (target.status === "ACTIVE") {
      return { activated: target, archived: null };
    }

    // Find currently active config (if any)
    const currentActive = await tx.globalSensorConfiguration.findFirst({
      where: { status: "ACTIVE" },
    });

    let archivedConfig = null;
    if (currentActive) {
      archivedConfig = await tx.globalSensorConfiguration.update({
        where: { id: currentActive.id },
        data: { status: "ARCHIVED" },
      });
    }

    const activatedConfig = await tx.globalSensorConfiguration.update({
      where: { id: target.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedByAdminId: adminId,
      },
    });

    await recordAuditEvent(
      {
        adminId,
        action: "GLOBAL_CONFIG_ACTIVATED",
        entityType: "GlobalSensorConfiguration",
        entityId: activatedConfig.id,
        metadata: {
          configVersion: target.configVersion,
          previousActiveVersion: currentActive?.configVersion ?? null,
        },
      },
      tx
    );

    return { activated: activatedConfig, archived: archivedConfig };
  });
}

/**
 * Lists all global configurations, newest first.
 */
export async function listGlobalConfigs() {
  return prisma.globalSensorConfiguration.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedByAdmin: { select: { username: true } },
      activatedByAdmin: { select: { username: true } },
    },
  });
}

/**
 * Returns the currently ACTIVE global configuration, or null if none.
 */
export async function getActiveGlobalConfig() {
  return prisma.globalSensorConfiguration.findFirst({
    where: { status: "ACTIVE" },
  });
}

// Backward-compatible alias
export const getActiveSensorConfig = async (_registeredDeviceId?: string) => getActiveGlobalConfig();
