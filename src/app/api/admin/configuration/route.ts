import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import {
  listGlobalConfigs,
  uploadGlobalConfig,
  GlobalConfigVersionConflictError,
  GlobalConfigVersionNotForwardError,
  GlobalConfigFileTooLargeError,
} from "@/lib/services/sensor-configs";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const configs = await listGlobalConfigs();
  return NextResponse.json({ configurations: configs });
}

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "validation_error", message: "Failed to parse multipart form data." },
      { status: 400 }
    );
  }

  const configVersionRaw = formData.get("configVersion");
  const fileRaw = formData.get("file");

  if (typeof configVersionRaw !== "string" || !configVersionRaw.trim()) {
    return NextResponse.json(
      { status: "validation_error", message: "Configuration version string is required." },
      { status: 400 }
    );
  }

  if (!(fileRaw instanceof File)) {
    return NextResponse.json(
      { status: "validation_error", message: "Configuration file is required." },
      { status: 400 }
    );
  }

  const file = fileRaw;
  if (file.size <= 0) {
    return NextResponse.json(
      { status: "validation_error", message: "Uploaded configuration file is empty." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const config = await uploadGlobalConfig({
      configVersion: configVersionRaw.trim(),
      originalFileName: file.name || "config.json",
      buffer,
      mimeType: file.type || "application/json",
      adminId: admin.id,
    });

    return NextResponse.json({ status: "success", configuration: config }, { status: 201 });
  } catch (error: any) {
    if (error instanceof GlobalConfigVersionConflictError) {
      return NextResponse.json(
        { status: "version_conflict", message: error.message },
        { status: 409 }
      );
    }
    if (error instanceof GlobalConfigVersionNotForwardError) {
      return NextResponse.json(
        { status: "version_not_forward", message: error.message },
        { status: 409 }
      );
    }
    if (error instanceof GlobalConfigFileTooLargeError) {
      return NextResponse.json(
        { status: "file_too_large", message: error.message },
        { status: 413 }
      );
    }

    console.error("Failed to upload global config:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to upload configuration." },
      { status: 400 }
    );
  }
}
