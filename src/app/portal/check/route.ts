import { NextResponse } from "next/server";
import { resolveSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";
import { performVersionCheck } from "@/lib/services/version-check";
import { getActiveGlobalConfig } from "@/lib/services/sensor-configs";
import { auditMetadataFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const activeConfig = await getActiveGlobalConfig();
  const currentVersion = device.sensorVersion ?? null;
  const activeVersion = activeConfig?.configVersion ?? null;

  let result = "CURRENT";
  let message = "Sensor configuration is current.";

  if (!activeConfig) {
    result = "NO_CONFIGURATION_AVAILABLE";
    message = "No active configuration is currently available.";
  } else if (!currentVersion) {
    result = "UPDATE_AVAILABLE";
    message = `No version currently installed on sensor. Active configuration version ${activeVersion} is available.`;
  } else if (currentVersion === activeVersion) {
    result = "CURRENT";
    message = `Sensor configuration is up to date (v${currentVersion}).`;
  } else {
    result = "UPDATE_AVAILABLE";
    message = `Update available: current version is v${currentVersion}, active server version is v${activeVersion}.`;
  }

  return NextResponse.json({
    status: "success",
    sensorId: device.deviceId,
    currentVersion,
    activeConfigVersion: activeVersion,
    result,
    isUpdateAvailable: result === "UPDATE_AVAILABLE",
    message,
  });
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body if sensor is authenticated via bearer token or query param
  }

  const rawObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const explicitSensorId =
    typeof rawObj.sensorId === "string"
      ? rawObj.sensorId
      : typeof rawObj.deviceId === "string"
      ? rawObj.deviceId
      : null;

  let device;
  try {
    device = await resolveSensorAuth(request, explicitSensorId);
  } catch (err: any) {
    if (err instanceof SensorUnauthorizedError) {
      return NextResponse.json(
        {
          result: "SENSOR_NOT_REGISTERED",
          activeConfigVersion: null,
          message: err.message,
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        result: "SENSOR_NOT_REGISTERED",
        activeConfigVersion: null,
        message: err.message || "Authentication failed.",
      },
      { status: 401 }
    );
  }

  // Determine current version: from body or from sensor's stored version
  let currentConfigVersion =
    typeof rawObj.currentConfigVersion === "string" && rawObj.currentConfigVersion.trim()
      ? rawObj.currentConfigVersion.trim()
      : typeof rawObj.currentVersion === "string" && rawObj.currentVersion.trim()
      ? rawObj.currentVersion.trim()
      : device.sensorVersion || "0.0.0";

  const { ipAddress, userAgent } = auditMetadataFromHeaders(request.headers);

  const outcome = await performVersionCheck({
    device,
    sensorId: device.deviceId,
    currentConfigVersion,
    ipAddress,
    userAgent,
  });

  const statusCode = outcome.result === "INVALID_VERSION" ? 400 : 200;

  return NextResponse.json(
    {
      result: outcome.result,
      activeConfigVersion: outcome.activeConfigVersion,
      currentVersion: currentConfigVersion,
      sensorId: device.deviceId,
      message: outcome.message,
    },
    { status: statusCode }
  );
}
