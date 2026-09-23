import type { RegisteredDevice, VersionCheckResult } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isValidSemver } from "@/lib/validation/semver";
import { getActiveGlobalConfig } from "./sensor-configs";

export interface VersionCheckInput {
  device: RegisteredDevice;
  sensorId: string;
  currentConfigVersion: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface VersionCheckOutcome {
  result: VersionCheckResult;
  activeConfigVersion: string | null;
  message: string;
}

/**
 * Truncates a date to midnight UTC for daily metric aggregation.
 */
export function getUtcMidnight(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Executes the version-check evaluation sequence, records the event in
 * SensorVersionCheckEvent, and updates DailySensorVersionCheckMetric.
 */
export async function performVersionCheck(input: VersionCheckInput): Promise<VersionCheckOutcome> {
  const { device, currentConfigVersion, ipAddress, userAgent } = input;

  let outcome: VersionCheckOutcome;

  // 1. Semver validation check
  if (!isValidSemver(currentConfigVersion)) {
    outcome = {
      result: "INVALID_VERSION",
      activeConfigVersion: null,
      message: "The reported version is not a valid semver string (expected format X.Y.Z).",
    };
  } else if (device.status === "DEACTIVE") {
    // 2. Sensor deactivated check
    outcome = {
      result: "SENSOR_DEACTIVATED",
      activeConfigVersion: null,
      message: "This sensor is currently deactivated.",
    };
  } else {
    // 3. Check active global configuration
    const activeConfig = await getActiveGlobalConfig();

    if (!activeConfig) {
      outcome = {
        result: "NO_CONFIGURATION_AVAILABLE",
        activeConfigVersion: null,
        message: "No active configuration is currently available.",
      };
    } else if (activeConfig.configVersion === currentConfigVersion.trim()) {
      outcome = {
        result: "CURRENT",
        activeConfigVersion: activeConfig.configVersion,
        message: "Your configuration is up to date.",
      };
    } else {
      outcome = {
        result: "UPDATE_AVAILABLE",
        activeConfigVersion: activeConfig.configVersion,
        message: `A newer configuration version (${activeConfig.configVersion}) is available.`,
      };
    }
  }

  // Record event and daily metric asynchronously
  const todayUtc = getUtcMidnight();

  Promise.all([
    prisma.sensorVersionCheckEvent.create({
      data: {
        registeredDeviceId: device.id,
        deviceId: device.deviceId,
        result: outcome.result,
        reportedVersion: currentConfigVersion,
        activeConfigVersion: outcome.activeConfigVersion,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    }),
    prisma.dailySensorVersionCheckMetric.upsert({
      where: {
        deviceId_date_result: {
          deviceId: device.deviceId,
          date: todayUtc,
          result: outcome.result,
        },
      },
      create: {
        deviceId: device.deviceId,
        date: todayUtc,
        result: outcome.result,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    }),
  ]).catch((err) => {
    console.error("Failed to record version-check event or metric:", err);
  });

  return outcome;
}
