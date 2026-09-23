import { prisma } from "@/lib/db";

export interface UploadSummaryStats {
  totalFiles: number;
  totalStorageBytes: number;
  last24h: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Overall upload counters for the dashboard's stat cards. */
export async function getUploadSummaryStats(): Promise<UploadSummaryStats> {
  const [totalFiles, sizeAgg, last24h] = await Promise.all([
    prisma.uploadedFileRecord.count(),
    prisma.uploadedFileRecord.aggregate({ _sum: { fileSizeBytes: true } }),
    prisma.uploadedFileRecord.count({
      where: { uploadedAt: { gte: new Date(Date.now() - ONE_DAY_MS) } },
    }),
  ]);
  return {
    totalFiles,
    totalStorageBytes: sizeAgg._sum.fileSizeBytes ?? 0,
    last24h,
  };
}

/** Most recent uploads, with the owning device's Device ID, for the dashboard's "recent uploads" card. */
export function listRecentUploads(limit = 5) {
  return prisma.uploadedFileRecord.findMany({
    orderBy: { uploadedAt: "desc" },
    take: limit,
    include: { registeredDevice: { select: { deviceId: true } } },
  });
}

export interface DailyUploadCount {
  date: string; // "YYYY-MM-DD"
  count: number;
}

/**
 * Upload counts bucketed by UTC day for the last `days` days (including
 * today), for the dashboard's activity summary. Buckets with zero uploads
 * are included so the chart always has `days` entries.
 */
export async function getUploadActivityByDay(days = 7): Promise<DailyUploadCount[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.uploadedFileRecord.findMany({
    where: { uploadedAt: { gte: since } },
    select: { uploadedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + i);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.uploadedAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}
