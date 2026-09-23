import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { DeviceNotFoundError } from "./devices";

export function generateSensorTokenString(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Issues or rotates a sensor API token.
 * Generates a 32-byte CSPRNG token (64 hex characters), hashes it with bcrypt (cost 12),
 * and updates RegisteredDevice.tokenHash.
 * The plain token is returned once and never stored unhashed.
 */
export async function issueSensorToken(registeredDeviceId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.findUnique({
      where: { id: registeredDeviceId },
    });
    if (!device) {
      throw new DeviceNotFoundError(registeredDeviceId);
    }

    const token = generateSensorTokenString();
    const tokenHash = await bcrypt.hash(token, 12);

    await tx.registeredDevice.update({
      where: { id: device.id },
      data: { tokenHash },
    });

    await recordAuditEvent(
      {
        adminId,
        action: "SENSOR_TOKEN_ISSUED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: {
          deviceId: device.deviceId,
          tokenPrefix: token.slice(0, 8),
        },
      },
      tx
    );

    return { token, deviceId: device.deviceId };
  });
}

/**
 * Revokes a sensor API token, immediately disabling bearer authentication for that sensor.
 */
export async function revokeSensorToken(registeredDeviceId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.registeredDevice.findUnique({
      where: { id: registeredDeviceId },
    });
    if (!device) {
      throw new DeviceNotFoundError(registeredDeviceId);
    }

    await tx.registeredDevice.update({
      where: { id: device.id },
      data: { tokenHash: null },
    });

    await recordAuditEvent(
      {
        adminId,
        action: "SENSOR_TOKEN_REVOKED",
        entityType: "RegisteredDevice",
        entityId: device.id,
        metadata: { deviceId: device.deviceId },
      },
      tx
    );

    return { success: true, deviceId: device.deviceId };
  });
}
