import type { DeviceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";

export class DeviceNotFoundError extends Error {
  constructor(id: string) {
    super(`Registered sensor "${id}" was not found.`);
    this.name = "DeviceNotFoundError";
  }
}

/**
 * Transitions a sensor between ACTIVE/DEACTIVE, recording a
 * DeviceStatusEvent and an AdminAuditEvent in the same transaction as the
 * status update. Idempotent: setting a sensor to its current status is a
 * no-op that still returns the device, but writes no extra event rows.
 */
export async function updateDeviceStatus(
  registeredDeviceId: string,
  newStatus: DeviceStatus,
  adminId: string,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.findUnique({
      where: { id: registeredDeviceId },
    });
    if (!device) throw new DeviceNotFoundError(registeredDeviceId);
    if (device.status === newStatus) return device;

    const updated = await tx.registeredDevice.update({
      where: { id: registeredDeviceId },
      data: { status: newStatus },
    });

    await tx.deviceStatusEvent.create({
      data: {
        registeredDeviceId: device.id,
        previousStatus: device.status,
        newStatus,
        changedByAdminId: adminId,
        reason: reason ?? null,
      },
    });

    await recordAuditEvent(
      {
        adminId,
        action: newStatus === "ACTIVE" ? "SENSOR_ACTIVATED" : "SENSOR_DEACTIVATED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: { deviceId: device.deviceId, reason: reason ?? null },
      },
      tx
    );

    return updated;
  });
}

/**
 * Permanently deletes a sensor:
 * In a single atomic transaction:
 * 1. Revokes any active token.
 * 2. Writes an AdminAuditEvent (SENSOR_DELETED).
 * 3. Deletes the RegisteredDevice record (cascading configured relations).
 */
export async function deleteSensor(idOrDeviceId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.findFirst({
      where: {
        OR: [{ id: idOrDeviceId }, { deviceId: idOrDeviceId }],
      },
    });
    if (!device) throw new DeviceNotFoundError(idOrDeviceId);

    // 1. Revoke token
    await tx.registeredDevice.update({
      where: { id: device.id },
      data: { tokenHash: null },
    });

    // 2. Record audit event (with safe adminId verification)
    const adminAccount = adminId ? await tx.adminAccount.findUnique({ where: { id: adminId } }) : null;
    await recordAuditEvent(
      {
        adminId: adminAccount?.id ?? null,
        action: "SENSOR_DELETED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: {
          deviceId: device.deviceId,
          deletedAt: new Date().toISOString(),
        },
      },
      tx
    );

    // 3. Delete registered device
    await tx.registeredDevice.delete({
      where: { id: device.id },
    });

    return { deleted: true, deviceId: device.deviceId };
  });
}
