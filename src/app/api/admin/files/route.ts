import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const query = params.get("q")?.trim() ?? undefined;
  const deviceIdFilter = params.get("deviceId")?.trim() ?? undefined;
  const mimeFilter = params.get("mime")?.trim() ?? undefined;

  const where: Record<string, unknown> = {};
  if (query) {
    where.OR = [
      { originalFileName: { contains: query, mode: "insensitive" } },
      { deviceId: { contains: query, mode: "insensitive" } },
      { uploadRecordId: { contains: query, mode: "insensitive" } },
    ];
  }
  if (deviceIdFilter) {
    where.deviceId = { contains: deviceIdFilter, mode: "insensitive" };
  }
  if (mimeFilter) {
    where.mimeType = { contains: mimeFilter, mode: "insensitive" };
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.uploadedFileRecord.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { registeredDevice: { select: { deviceId: true } } },
      }),
      prisma.uploadedFileRecord.count({ where }),
    ]);

    return NextResponse.json({
      files: rows.map((f) => ({
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
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Failed to list files:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
