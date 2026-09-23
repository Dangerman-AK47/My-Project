import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { revokeSensorToken } from "@/lib/services/sensor-tokens";
import { DeviceNotFoundError } from "@/lib/services/devices";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await revokeSensorToken(params.id, admin.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DeviceNotFoundError) {
      return NextResponse.json({ error: "Sensor not found." }, { status: 404 });
    }
    console.error("Failed to revoke sensor token:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
