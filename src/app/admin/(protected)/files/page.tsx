import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { FilesPageClient } from "@/components/admin/files-page-client";

export const metadata: Metadata = {
  title: "Uploaded Files — FileVault Admin",
};

const PAGE_SIZE = 20;

export default async function AdminFilesPage() {
  const [rows, total] = await Promise.all([
    prisma.uploadedFileRecord.findMany({
      orderBy: { uploadedAt: "desc" },
      take: PAGE_SIZE,
      include: { registeredDevice: { select: { deviceId: true } } },
    }),
    prisma.uploadedFileRecord.count(),
  ]);

  const files = rows.map((f) => ({
    id: f.id,
    uploadRecordId: f.uploadRecordId,
    deviceId: f.deviceId,
    originalFileName: f.originalFileName,
    mimeType: f.mimeType,
    fileExtension: f.fileExtension,
    fileSizeBytes: f.fileSizeBytes,
    uploadedAt: f.uploadedAt.toISOString(),
    uploadStatus: f.uploadStatus,
    storageKey: f.storageKey,
  }));

  return (
    <FilesPageClient
      initialFiles={files}
      initialTotal={total}
      initialPage={1}
      pageSize={PAGE_SIZE}
    />
  );
}
