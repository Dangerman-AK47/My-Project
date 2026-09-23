import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { formatUploadId } from "@/lib/upload/format";

export class DeviceNotActiveError extends Error {
  constructor(deviceId: string) {
    super(`Sensor "${deviceId}" is not active and cannot accept uploads.`);
    this.name = "DeviceNotActiveError";
  }
}

// Alias for backward compatibility
export const DeviceNotEnabledError = DeviceNotActiveError;

export interface RecordUploadInput {
  registeredDeviceId: string;
  deviceId: string;
  originalFileName: string;
  storageKey: string;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  checksum?: string;
  storageProvider?: string;
  /** Audit metadata; omit adminId since public uploads have no admin actor. */
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}

/**
 * Records a completed file upload: creates the UploadedFileRecord (and
 * stamps its human-readable `uploadRecordId`, e.g. "UP-000042", from the
 * row's real Postgres sequence number), creates the matching
 * UploadStorageObject, increments the owning device's uploadCount and
 * totalStorageBytes, stamps lastUploadAt, and logs an AdminAuditEvent —
 * all in one transaction so none of these can drift apart.
 */
export async function recordUpload(input: RecordUploadInput) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.findUnique({
      where: { id: input.registeredDeviceId },
    });
    if (!device) {
      throw new Error(`Registered sensor "${input.registeredDeviceId}" was not found.`);
    }
    if (device.status !== "ACTIVE") {
      throw new DeviceNotActiveError(device.deviceId);
    }

    const created = await tx.uploadedFileRecord.create({
      data: {
        registeredDeviceId: device.id,
        deviceId: input.deviceId,
        originalFileName: input.originalFileName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        fileExtension: input.fileExtension,
        fileSizeBytes: input.fileSizeBytes,
        checksum: input.checksum,
        uploadStatus: "STORED",
      },
    });

    const fileRecord = await tx.uploadedFileRecord.update({
      where: { id: created.id },
      data: { uploadRecordId: formatUploadId(created.sequenceNumber) },
    });

    await tx.uploadStorageObject.create({
      data: {
        uploadedFileRecordId: fileRecord.id,
        storageProvider: input.storageProvider ?? "local",
        storageKey: input.storageKey,
      },
    });

    const updatedDevice = await tx.registeredDevice.update({
      where: { id: device.id },
      data: {
        uploadCount: { increment: 1 },
        totalStorageBytes: { increment: BigInt(input.fileSizeBytes) },
        lastUploadAt: new Date(),
      },
    });

    await recordAuditEvent(
      {
        adminId: null,
        action: "FILE_UPLOADED",
        entityType: "UploadedFileRecord",
        entityId: fileRecord.id,
        metadata: {
          deviceId: device.deviceId,
          originalFileName: fileRecord.originalFileName,
          fileSizeBytes: fileRecord.fileSizeBytes,
        },
        ipAddress: input.requestMeta?.ipAddress ?? null,
        userAgent: input.requestMeta?.userAgent ?? null,
      },
      tx
    );

    return { fileRecord, device: updatedDevice };
  });
}
