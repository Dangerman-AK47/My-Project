import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceIdSchema } from "@/lib/validation/device-id";
import {
  autoRegisterWithToken,
  DuplicateRegistrationError,
} from "@/lib/services/registration-requests";

export const runtime = "nodejs";

const registerBodySchema = z.object({
  sensorId: deviceIdSchema.optional(),
  deviceId: deviceIdSchema.optional(),
}).refine((data) => data.sensorId || data.deviceId, {
  message: "sensorId (or deviceId) is required.",
  path: ["sensorId"],
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { status: "validation_error", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const parsed = registerBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "validation_error",
          message: parsed.error.issues[0]?.message || "Validation failed.",
          errors: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const sensorId = (parsed.data.sensorId || parsed.data.deviceId)!;

    const { token, device } = await autoRegisterWithToken(sensorId);

    return NextResponse.json(
      {
        sensorId: device.deviceId,
        token,
        status: device.status,
        message: "Sensor registered successfully. Store this token securely; it will not be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) {
      return NextResponse.json(
        { status: "already_registered", message: error.message },
        { status: 409 }
      );
    }

    console.error("Unexpected error in POST /api/v1/sensors/register:", error);
    return NextResponse.json(
      { status: "error", message: "An unexpected error occurred during sensor registration." },
      { status: 500 }
    );
  }
}
