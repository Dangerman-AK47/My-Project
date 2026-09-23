import { NextResponse } from "next/server";
import { requireSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";
import { performVersionCheck } from "@/lib/services/version-check";
import { auditMetadataFromHeaders } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let device;
  try {
    device = await requireSensorAuth(request);
  } catch (err) {
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
        message: "Authentication failed.",
      },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        result: "INVALID_VERSION",
        activeConfigVersion: null,
        message: "Invalid JSON request body.",
      },
      { status: 400 }
    );
  }

  const rawObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const currentConfigVersion =
    typeof rawObj.currentConfigVersion === "string" ? rawObj.currentConfigVersion : "";
  const sensorId =
    typeof rawObj.sensorId === "string"
      ? rawObj.sensorId
      : typeof rawObj.deviceId === "string"
      ? rawObj.deviceId
      : device.deviceId;

  const { ipAddress, userAgent } = auditMetadataFromHeaders(request.headers);

  const outcome = await performVersionCheck({
    device,
    sensorId,
    currentConfigVersion,
    ipAddress,
    userAgent,
  });

  const statusCode = outcome.result === "INVALID_VERSION" ? 400 : 200;

  return NextResponse.json(outcome, { status: statusCode });
}
