import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { updateDeviceStatus, DeviceNotFoundError } from "@/lib/services/devices";
import type { DeviceStatusValue } from "@/lib/admin/devices-types";

const bodySchema = z.object({
  status: z.enum(["ACTIVE", "DEACTIVE"]),
  reason: z.string().trim().max(500).optional(),
});

export interface SensorStatusUpdateResponse {
  device: {
    id: string;
    deviceId: string;
    status: DeviceStatusValue;
    updatedAt: string;
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<SensorStatusUpdateResponse | { error: string }>> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid status (ACTIVE or DEACTIVE)." }, { status: 400 });
  }

  try {
    const device = await updateDeviceStatus(
      params.id,
      parsed.data.status,
      admin.id,
      parsed.data.reason
    );
    return NextResponse.json({
      device: {
        id: device.id,
        deviceId: device.deviceId,
        status: device.status,
        updatedAt: device.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof DeviceNotFoundError) {
      return NextResponse.json({ error: "Sensor not found." }, { status: 404 });
    }
    console.error("Failed to update sensor status:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
