import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";

/**
 * Example protected admin API route. Confirms API-route protection works
 * end-to-end; later parts add the real device/request/file API routes
 * following this same `getAuthorizedAdmin()` guard pattern.
 */
export async function GET() {
  const admin = await getAuthorizedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: admin.id,
    username: admin.username,
    role: admin.role,
  });
}
