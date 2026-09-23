import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";

export const runtime = "nodejs";

const heartbeatBodySchema = z.object({
  sensorId: z.string().optional(),
  deviceId: z.string().optional(),
  sensorVersion: z.string().optional(),
  firmwareVersion: z.string().optional(),
  hardwareModel: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const device = await requireSensorAuth(request);

    let rawBody: unknown = {};
    try {
      rawBody = await request.json();
    } catch {
      // Body can be empty or optional
    }

    const parsed = heartbeatBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "validation_error",
          message: parsed.error.issues[0]?.message || "Validation failed.",
        },
        { status: 400 }
      );
    }

    const { sensorId, deviceId, sensorVersion, firmwareVersion, hardwareModel, metadata } =
      parsed.data;

    // Cross-validate sensorId if provided
    const providedId = (sensorId || deviceId)?.trim().toUpperCase();
    if (providedId && providedId !== device.deviceId.toUpperCase()) {
      return NextResponse.json(
        { status: "unauthorized", message: "Sensor ID does not match authenticated token." },
        { status: 401 }
      );
    }

    const updateData: {
      lastSeenAt: Date;
      sensorVersion?: string;
      firmwareVersion?: string;
      hardwareModel?: string;
      metadata?: any;
    } = {
      lastSeenAt: new Date(),
    };

    if (sensorVersion !== undefined) updateData.sensorVersion = sensorVersion;
    if (firmwareVersion !== undefined) updateData.firmwareVersion = firmwareVersion;
    if (hardwareModel !== undefined) updateData.hardwareModel = hardwareModel;
    if (metadata !== undefined) updateData.metadata = metadata;

    await prisma.registeredDevice.update({
      where: { id: device.id },
      data: updateData,
    });

    return NextResponse.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      sensorStatus: device.status,
    });
  } catch (error) {
    if (error instanceof SensorUnauthorizedError) {
      return NextResponse.json(
        { status: "unauthorized", message: error.message },
        { status: 401 }
      );
    }

    console.error("Unexpected error in POST /api/v1/sensors/heartbeat:", error);
    return NextResponse.json(
      { status: "error", message: "An unexpected error occurred while processing heartbeat." },
      { status: 500 }
    );
  }
}
