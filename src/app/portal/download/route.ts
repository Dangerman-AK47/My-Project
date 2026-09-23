import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";
import { getActiveGlobalConfig } from "@/lib/services/sensor-configs";
import { getStorageDriver } from "@/lib/storage";
import { auditMetadataFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

async function handleDownload(request: Request) {
  let device;
  try {
    device = await resolveSensorAuth(request);
  } catch (err: any) {
    if (err instanceof SensorUnauthorizedError) {
      return NextResponse.json(
        { status: "unauthorized", message: err.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: "unauthorized", message: err.message || "Authentication failed." },
      { status: 401 }
    );
  }

  // Check sensor status
  if (device.status !== "ACTIVE") {
    return NextResponse.json(
      { status: "sensor_deactivated", message: "This sensor is currently deactivated." },
      { status: 403 }
    );
  }

  // Get active global configuration
  const config = await getActiveGlobalConfig();
  if (!config) {
    return NextResponse.json(
      { status: "no_configuration", message: "No active configuration available." },
      { status: 404 }
    );
  }

  // Read config file from storage driver
  const driver = getStorageDriver();
  let fileBuffer: Buffer;
  try {
    fileBuffer = await driver.read(config.storageKey);
  } catch (err) {
    console.error(`Failed to read config file at "${config.storageKey}":`, err);
    return NextResponse.json(
      { status: "error", message: "Configuration file not found on storage." },
      { status: 500 }
    );
  }

  // Requirement: When a sensor downloads the configuration file, that configuration's
  // file version is automatically updated as that sensor's current version (sensorVersion).
  const { ipAddress, userAgent } = auditMetadataFromHeaders(request.headers);
  await Promise.all([
    prisma.sensorConfigDownloadEvent.create({
      data: {
        registeredDeviceId: device.id,
        deviceId: device.deviceId,
        globalConfigId: config.id,
        configVersion: config.configVersion,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    }),
    prisma.registeredDevice.update({
      where: { id: device.id },
      data: {
        sensorVersion: config.configVersion,
        lastSeenAt: new Date(),
      },
    }),
  ]).catch((err) => {
    console.error("Failed to log config download or update sensor's current version:", err);
  });

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": config.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(config.originalFileName)}"`,
      "Content-Length": config.fileSizeBytes.toString(),
      "X-Config-Version": config.configVersion,
      "X-Sensor-Version-Updated": config.configVersion,
    },
  });
}

export async function GET(request: Request) {
  return handleDownload(request);
}

export async function POST(request: Request) {
  return handleDownload(request);
}
