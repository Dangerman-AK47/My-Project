import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deviceIdSchema } from "@/lib/validation/device-id";
import { autoRegisterSensor } from "@/lib/services/registration-requests";
import type { DeviceRequestApiResponse } from "@/lib/upload/types";

export const runtime = "nodejs";

const GENERIC_ERROR_MESSAGE = "Something went wrong submitting your request. Please try again.";

/**
 * Handles sensor registration from the public upload page.
 * Immediately registers and auto-approves the sensor so it can upload files right away.
 */
export async function POST(request: Request): Promise<NextResponse<DeviceRequestApiResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request body." }, { status: 400 });
  }

  const deviceIdRaw =
    typeof body === "object" && body !== null && "deviceId" in body
      ? (body as Record<string, unknown>).deviceId
      : undefined;

  const parsed = deviceIdSchema.safeParse(deviceIdRaw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "validation_error",
        message: "Please provide a valid Sensor ID.",
        fieldErrors: { deviceId: parsed.error.issues[0]?.message },
      },
      { status: 400 }
    );
  }

  const deviceId = parsed.data;

  try {
    const existing = await prisma.registeredDevice.findUnique({ where: { deviceId } });
    if (existing) {
      return NextResponse.json({
        status: "already_pending",
        message: `Sensor "${deviceId}" is already registered.`,
      });
    }

    await autoRegisterSensor(deviceId);
    return NextResponse.json({
      status: "submitted",
      message: `Sensor "${deviceId}" has been registered and auto-approved. You can now upload files.`,
    });
  } catch (err) {
    console.error("Sensor auto-registration request failed:", err);
    return NextResponse.json({ status: "error", message: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
