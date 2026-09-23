import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import {
  activateGlobalConfig,
  GlobalConfigNotFoundError,
} from "@/lib/services/sensor-configs";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json(
      { status: "validation_error", message: "Configuration ID is required." },
      { status: 400 }
    );
  }

  try {
    const result = await activateGlobalConfig(id, admin.id);
    return NextResponse.json({ status: "success", data: result });
  } catch (error: any) {
    if (error instanceof GlobalConfigNotFoundError) {
      return NextResponse.json(
        { status: "not_found", message: error.message },
        { status: 404 }
      );
    }

    console.error("Failed to activate global config:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to activate configuration." },
      { status: 500 }
    );
  }
}
