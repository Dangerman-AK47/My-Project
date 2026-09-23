import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { getStorageDriver } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fileRecord = await tx.uploadedFileRecord.findUnique({
        where: { id: params.id },
        include: { storageObjects: true, registeredDevice: true },
      });
      if (!fileRecord) return null;

      // Delete physical files from storage
      const driver = getStorageDriver();
      for (const obj of fileRecord.storageObjects) {
        try {
          await driver.delete(obj.storageKey);
        } catch {
          // Log but don't fail the transaction if file already gone
          console.warn(`Could not delete storage object ${obj.storageKey} — may already be deleted.`);
        }
      }

      // Delete storage objects
      await tx.uploadStorageObject.deleteMany({
        where: { uploadedFileRecordId: fileRecord.id },
      });

      // Delete file record
      await tx.uploadedFileRecord.delete({
        where: { id: fileRecord.id },
      });

      // Decrement device counters
      await tx.registeredDevice.update({
        where: { id: fileRecord.registeredDeviceId },
        data: {
          uploadCount: { decrement: 1 },
          totalStorageBytes: { decrement: BigInt(fileRecord.fileSizeBytes) },
        },
      });

      await recordAuditEvent(
        {
          adminId: admin.id,
          action: "FILE_DELETED",
          entityType: "UploadedFileRecord",
          entityId: fileRecord.id,
          metadata: {
            deviceId: fileRecord.deviceId,
            originalFileName: fileRecord.originalFileName,
            fileSizeBytes: fileRecord.fileSizeBytes,
          },
        },
        tx
      );

      return fileRecord;
    });

    if (!result) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    return NextResponse.json({ status: "deleted", id: params.id });
  } catch (err) {
    console.error("Failed to delete file:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const fileRecord = await prisma.uploadedFileRecord.findUnique({
      where: { id: params.id },
      include: { storageObjects: true },
    });
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const driver = getStorageDriver();
    const buffer = await driver.read(fileRecord.storageKey);

    // Stream the buffer as a ReadableStream to avoid Buffer/ArrayBuffer type issues
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileRecord.originalFileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Failed to download file:", err);
    return NextResponse.json({ error: "File could not be retrieved." }, { status: 500 });
  }
}
