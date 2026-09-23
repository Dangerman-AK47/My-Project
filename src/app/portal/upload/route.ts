import path from "path";
import { NextResponse } from "next/server";
import { resolveSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";
import { getStorageDriver, sanitizeFileName, getMaxUploadBytes } from "@/lib/storage";
import { getEnv } from "@/lib/env";
import { recordUpload, DeviceNotActiveError } from "@/lib/services/uploads";
import { auditMetadataFromHeaders } from "@/lib/audit";
import type { RegisteredDevice } from "@prisma/client";

export const runtime = "nodejs";

const GENERIC_ERROR_MESSAGE = "Something went wrong while uploading. Please try again.";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Could not read multipart form upload. Please try again." },
      { status: 400 }
    );
  }

  const formSensorId = formData.get("sensorId") ?? formData.get("deviceId");
  const explicitSensorId = typeof formSensorId === "string" ? formSensorId : null;

  let device: RegisteredDevice;
  try {
    device = await resolveSensorAuth(request, explicitSensorId);
  } catch (err: any) {
    if (err instanceof SensorUnauthorizedError) {
      return NextResponse.json(
        { status: "unauthorized", message: err.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { status: "unauthorized", message: err.message || "Authentication failed." },
      { status: 401 }
    );
  }

  if (device.status !== "ACTIVE") {
    return NextResponse.json(
      { status: "device_disabled", message: "This sensor is currently deactivated." },
      { status: 403 }
    );
  }

  const fileRaw = formData.get("file");
  if (!(fileRaw instanceof File)) {
    return NextResponse.json(
      {
        status: "validation_error",
        message: "A file is required.",
        fieldErrors: { file: "A file is required." },
      },
      { status: 400 }
    );
  }

  const file = fileRaw;
  if (file.size <= 0) {
    return NextResponse.json(
      {
        status: "validation_error",
        message: "The selected file is empty.",
        fieldErrors: { file: "The selected file is empty." },
      },
      { status: 400 }
    );
  }

  const maxBytes = getMaxUploadBytes();
  if (file.size > maxBytes) {
    const maxMb = getEnv().MAX_FILE_SIZE_MB;
    return NextResponse.json(
      {
        status: "validation_error",
        message: `File exceeds the ${maxMb} MB limit.`,
        fieldErrors: { file: `File exceeds the ${maxMb} MB limit.` },
      },
      { status: 413 }
    );
  }

  try {
    const originalFileName = sanitizeFileName(file.name || "upload");
    const fileExtension = path.extname(originalFileName);
    const mimeType =
      typeof file.type === "string" && file.type.length > 0
        ? file.type
        : "application/octet-stream";

    const buffer = Buffer.from(await file.arrayBuffer());
    const driver = getStorageDriver();
    const saved = await driver.save({ originalFileName, buffer });

    const requestMeta = auditMetadataFromHeaders(request.headers);

    const { fileRecord } = await recordUpload({
      registeredDeviceId: device.id,
      deviceId: device.deviceId,
      originalFileName,
      storageKey: saved.storagePath,
      mimeType,
      fileExtension,
      fileSizeBytes: saved.fileSize,
      checksum: saved.checksumSha256,
      requestMeta,
    });

    return NextResponse.json({
      status: "success",
      message: "File uploaded successfully.",
      data: {
        uploadId: fileRecord.uploadRecordId,
        deviceId: device.deviceId,
        originalFileName: fileRecord.originalFileName,
        mimeType: fileRecord.mimeType,
        fileSizeBytes: fileRecord.fileSizeBytes,
        uploadedAt: fileRecord.uploadedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof DeviceNotActiveError) {
      return NextResponse.json(
        { status: "device_disabled", message: "This sensor is currently deactivated." },
        { status: 403 }
      );
    }
    console.error("Upload failed in /portal/upload:", err);
    return NextResponse.json({ status: "error", message: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Portal upload endpoint. Submit a POST request with multipart/form-data containing 'file' and 'sensorId' (or Bearer token).",
  });
}
