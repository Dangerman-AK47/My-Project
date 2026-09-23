import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { getDeviceDetail } from "@/lib/services/device-queries";
import { deleteSensor, DeviceNotFoundError } from "@/lib/services/devices";
import type { DeviceDetailResponse } from "@/lib/admin/devices-types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<DeviceDetailResponse | { error: string }>> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const detail = await getDeviceDetail(params.id);
    if (!detail) {
      return NextResponse.json({ error: "Sensor not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error("Failed to load sensor detail:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await deleteSensor(params.id, admin.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof DeviceNotFoundError) {
      return NextResponse.json({ error: "Sensor not found." }, { status: 404 });
    }
    console.error("Failed to delete sensor:", err);
    return NextResponse.json({ error: "Failed to delete sensor." }, { status: 500 });
  }
}
