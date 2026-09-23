import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deviceIdSchema } from "@/lib/validation/device-id";
import { getStorageDriver, sanitizeFileName, getMaxUploadBytes } from "@/lib/storage";
import { getEnv } from "@/lib/env";
import { recordUpload, DeviceNotActiveError } from "@/lib/services/uploads";
import { requireSensorAuth, SensorUnauthorizedError } from "@/lib/auth/sensor-guard";
import { auditMetadataFromHeaders } from "@/lib/audit";
import type { UploadApiResponse, UploadSuccessData } from "@/lib/upload/types";
import type { RegisteredDevice } from "@prisma/client";

export const runtime = "nodejs";

const GENERIC_ERROR_MESSAGE = "Something went wrong while uploading. Please try again.";

export async function POST(request: Request): Promise<NextResponse<UploadApiResponse>> {
  let device: RegisteredDevice;

  // 1. Try bearer-token authentication first
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      device = await requireSensorAuth(request);
    } catch (err) {
      if (err instanceof SensorUnauthorizedError) {
        return NextResponse.json(
          { status: "unauthorized" as any, message: err.message },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { status: "error", message: "Authentication failed." },
        { status: 401 }
      );
    }
  }

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Could not read the upload. Please try again." },
      { status: 400 }
    );
  }

  const deviceIdRaw = formData.get("deviceId") ?? formData.get("sensorId");
  const fileRaw = formData.get("file");

  // If not authenticated via Bearer token, deviceId is required to look up sensor
  if (!device!) {
    if (typeof deviceIdRaw !== "string") {
      return NextResponse.json(
        {
          status: "validation_error",
          message: "Bearer token or Sensor ID is required.",
          fieldErrors: { deviceId: "Sensor ID is required." },
        },
        { status: 400 }
      );
    }

    const parsedDeviceId = deviceIdSchema.safeParse(deviceIdRaw);
    if (!parsedDeviceId.success) {
      return NextResponse.json(
        {
          status: "validation_error",
          message: "Please fix the highlighted fields.",
          fieldErrors: { deviceId: parsedDeviceId.error.issues[0]?.message },
        },
        { status: 400 }
      );
    }

    const foundDevice = await prisma.registeredDevice.findUnique({
      where: { deviceId: parsedDeviceId.data },
    });

    if (!foundDevice) {
      return NextResponse.json(
        {
          status: "device_not_registered",
          deviceId: parsedDeviceId.data,
          message: "This sensor is not registered. Please register first.",
        },
        { status: 404 }
      );
    }

    device = foundDevice;
  }

  // 3. Check sensor status
  if (device.status !== "ACTIVE") {
    return NextResponse.json(
      {
        status: "device_disabled",
        message: "This sensor is currently deactivated. Please contact the administrator.",
      },
      { status: 403 }
    );
  }

  // 4. Validate file
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

    const responseData: UploadSuccessData = {
      uploadId: fileRecord.uploadRecordId,
      deviceId: device.deviceId,
      originalFileName: fileRecord.originalFileName,
      mimeType: fileRecord.mimeType,
      fileSizeBytes: fileRecord.fileSizeBytes,
      uploadedAt: fileRecord.uploadedAt.toISOString(),
    };

    return NextResponse.json({ status: "success", data: responseData });
  } catch (err) {
    if (err instanceof DeviceNotActiveError) {
      return NextResponse.json(
        {
          status: "device_disabled",
          message: "This sensor is currently deactivated. Please contact the administrator.",
        },
        { status: 403 }
      );
    }
    console.error("Upload failed in /api/v1/sensors/upload:", err);
    return NextResponse.json({ status: "error", message: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
