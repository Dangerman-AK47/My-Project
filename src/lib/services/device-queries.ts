import type { DeviceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  DeviceDetailResponse,
  DeviceListItem,
  DeviceListQuery,
  DeviceListResponse,
  DeviceSortField,
  DeviceStatsResponse,
  SortDirection,
} from "@/lib/admin/devices-types";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function buildOrderBy(
  sortBy: DeviceSortField,
  sortDir: SortDirection
): Prisma.RegisteredDeviceOrderByWithRelationInput {
  switch (sortBy) {
    case "uploadCount":
      return { uploadCount: sortDir };
    case "lastActivity":
      return { updatedAt: sortDir };
    case "registeredAt":
    default:
      return { registeredAt: sortDir };
  }
}

/** Lists sensors with search, status filter, sort, and pagination — all applied in the DB. */
export async function listDevices(query: DeviceListQuery): Promise<DeviceListResponse> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const sortBy = query.sortBy ?? "registeredAt";
  const sortDir = query.sortDir ?? "desc";

  const where: Prisma.RegisteredDeviceWhereInput = {};
  const trimmedQuery = query.query?.trim();
  if (trimmedQuery) {
    where.deviceId = { contains: trimmedQuery, mode: "insensitive" };
  }
  if (query.status && query.status !== "ALL") {
    where.status = query.status as DeviceStatus;
  }

  const [rows, total] = await Promise.all([
    prisma.registeredDevice.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortDir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.registeredDevice.count({ where }),
  ]);

  const devices: DeviceListItem[] = rows.map((row) => ({
    id: row.id,
    deviceId: row.deviceId,
    status: row.status,
    registeredAt: row.registeredAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUploadAt: row.lastUploadAt ? row.lastUploadAt.toISOString() : null,
    uploadCount: row.uploadCount,
    totalStorageBytes: row.totalStorageBytes.toString(),
    lastActivity: row.updatedAt.toISOString(),
    firstSeenAt: row.firstSeenAt ? row.firstSeenAt.toISOString() : null,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    hasToken: Boolean(row.tokenHash),
  }));

  return { devices, total, page, pageSize };
}

/** Counts sensors by status — used by both the sensors API and the dashboard overview. */
export async function getDeviceStatusCounts(): Promise<DeviceStatsResponse> {
  const [total, active, deactive] = await Promise.all([
    prisma.registeredDevice.count(),
    prisma.registeredDevice.count({ where: { status: "ACTIVE" } }),
    prisma.registeredDevice.count({ where: { status: "DEACTIVE" } }),
  ]);
  return { total, active, deactive };
}

/** Full detail for one sensor, including its 5 most recent uploads and status changes. */
export async function getDeviceDetail(id: string): Promise<DeviceDetailResponse | null> {
  const device = await prisma.registeredDevice.findUnique({
    where: { id },
    include: {
      uploadedFiles: { orderBy: { uploadedAt: "desc" }, take: 5 },
      statusEvents: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { changedByAdmin: { select: { username: true } } },
      },
    },
  });

  if (!device) return null;

  return {
    device: {
      id: device.id,
      deviceId: device.deviceId,
      status: device.status,
      registeredAt: device.registeredAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
      lastUploadAt: device.lastUploadAt ? device.lastUploadAt.toISOString() : null,
      uploadCount: device.uploadCount,
      totalStorageBytes: device.totalStorageBytes.toString(),
      firstSeenAt: device.firstSeenAt ? device.firstSeenAt.toISOString() : null,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
      sensorVersion: device.sensorVersion,
      firmwareVersion: device.firmwareVersion,
      hardwareModel: device.hardwareModel,
      hasToken: Boolean(device.tokenHash),
    },
    recentUploads: device.uploadedFiles.map((file) => ({
      id: file.id,
      uploadRecordId: file.uploadRecordId,
      originalFileName: file.originalFileName,
      fileSizeBytes: file.fileSizeBytes,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt.toISOString(),
    })),
    recentStatusEvents: device.statusEvents.map((event) => ({
      id: event.id,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      reason: event.reason,
      changedByUsername: event.changedByAdmin?.username ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
