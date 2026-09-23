import bcrypt from "bcryptjs";
import type { RegisteredDevice } from "@prisma/client";
import { prisma } from "@/lib/db";

export class SensorUnauthorizedError extends Error {
  constructor(message = "Unauthorized: Invalid or missing sensor API token.") {
    super(message);
    this.name = "SensorUnauthorizedError";
  }
}

/**
 * Extracts and verifies the bearer token from a sensor request.
 * If targetDeviceId is known, does a fast O(1) indexed lookup on that device.
 * Otherwise, scans candidate registered devices with tokenHash.
 * On success, updates lastSeenAt (and firstSeenAt if not yet set) asynchronously.
 */
export async function requireSensorAuth(
  request: Request,
  targetDeviceId?: string | null
): Promise<RegisteredDevice> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new SensorUnauthorizedError("Bearer token is required.");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new SensorUnauthorizedError("Token cannot be empty.");
  }

  let matchedDevice: RegisteredDevice | null = null;

  // Fast path: if device ID is known, verify token on that single device
  if (targetDeviceId) {
    const candidate = await prisma.registeredDevice.findUnique({
      where: { deviceId: targetDeviceId.trim().toUpperCase() },
    });
    if (candidate && candidate.tokenHash) {
      const match = await bcrypt.compare(token, candidate.tokenHash);
      if (match) {
        matchedDevice = candidate;
      }
    }
  }

  // Fallback: scan candidate sensors if not matched via fast path
  if (!matchedDevice && !targetDeviceId) {
    const candidates = await prisma.registeredDevice.findMany({
      where: { tokenHash: { not: null } },
    });

    for (const candidate of candidates) {
      if (candidate.tokenHash) {
        const match = await bcrypt.compare(token, candidate.tokenHash);
        if (match) {
          matchedDevice = candidate;
          break;
        }
      }
    }
  }

  if (!matchedDevice) {
    throw new SensorUnauthorizedError("Invalid or revoked sensor token.");
  }

  // Update telemetry timestamps (fire-and-forget)
  const now = new Date();
  const updateData: { lastSeenAt: Date; firstSeenAt?: Date } = { lastSeenAt: now };
  if (!matchedDevice.firstSeenAt) {
    updateData.firstSeenAt = now;
  }

  prisma.registeredDevice
    .update({
      where: { id: matchedDevice.id },
      data: updateData,
    })
    .catch((err) => {
      console.error(`Failed to update lastSeenAt for sensor ${matchedDevice?.id}:`, err);
    });

  return matchedDevice;
}

/**
 * Resolves sensor identity via Bearer token, query parameter, header, or explicit sensor ID.
 * Verifies that the sensor exists and is ACTIVE.
 */
export async function resolveSensorAuth(
  request: Request,
  explicitSensorId?: string | null
): Promise<RegisteredDevice> {
  let sensorId = explicitSensorId;
  if (!sensorId) {
    sensorId =
      request.headers.get("x-sensor-id") ||
      request.headers.get("x-device-id");
  }

  if (!sensorId) {
    try {
      const url = new URL(request.url);
      sensorId = url.searchParams.get("sensorId") || url.searchParams.get("deviceId");
    } catch {
      // url parsing fallback
    }
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken && rawToken !== "undefined" && rawToken !== "null") {
      try {
        return await requireSensorAuth(request, sensorId);
      } catch (err) {
        if (!sensorId) {
          throw err;
        }
      }
    }
  }

  if (!sensorId || typeof sensorId !== "string" || !sensorId.trim()) {
    throw new SensorUnauthorizedError("Bearer token or sensor ID is required.");
  }

  const normalized = sensorId.trim().toUpperCase();
  const device = await prisma.registeredDevice.findUnique({
    where: { deviceId: normalized },
  });

  if (!device) {
    throw new SensorUnauthorizedError(`Sensor "${normalized}" is not registered.`);
  }

  if (device.status !== "ACTIVE") {
    throw new SensorUnauthorizedError(`Sensor "${normalized}" is currently deactivated.`);
  }

  // Update telemetry timestamps (fire-and-forget)
  const now = new Date();
  const updateData: { lastSeenAt: Date; firstSeenAt?: Date } = { lastSeenAt: now };
  if (!device.firstSeenAt) {
    updateData.firstSeenAt = now;
  }

  prisma.registeredDevice
    .update({
      where: { id: device.id },
      data: updateData,
    })
    .catch((err) => {
      console.error(`Failed to update lastSeenAt for sensor ${device.id}:`, err);
    });

  return device;
}
