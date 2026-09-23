import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { getDeviceStatusCounts } from "@/lib/services/device-queries";
import type { DeviceStatsResponse } from "@/lib/admin/devices-types";

export async function GET(): Promise<NextResponse<DeviceStatsResponse | { error: string }>> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const counts = await getDeviceStatusCounts();
    return NextResponse.json(counts);
  } catch (err) {
    console.error("Failed to load sensor stats:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
