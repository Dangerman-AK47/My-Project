// Shared types for the admin sensors API and UI. Plain types only — no
// server-only or Node-specific imports — so they're safe to import from
// client components as well as route handlers/services.

export type DeviceStatusValue = "ACTIVE" | "DEACTIVE";

export type DeviceStatusFilter = "ALL" | DeviceStatusValue;
export type DeviceSortField = "registeredAt" | "uploadCount" | "lastActivity";
export type SortDirection = "asc" | "desc";

export interface DeviceListQuery {
  query?: string;
  status?: DeviceStatusFilter;
  sortBy?: DeviceSortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface DeviceListItem {
  id: string;
  deviceId: string;
  status: DeviceStatusValue;
  registeredAt: string; // ISO
  updatedAt: string; // ISO
  lastUploadAt: string | null; // ISO
  uploadCount: number;
  totalStorageBytes: string; // BigInt serialized as a string
  lastActivity: string; // ISO
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  hasToken?: boolean;
}

export interface DeviceListResponse {
  devices: DeviceListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadSummaryItem {
  id: string;
  uploadRecordId: string;
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string; // ISO
}

export interface DeviceStatusEventItem {
  id: string;
  previousStatus: DeviceStatusValue | null;
  newStatus: DeviceStatusValue;
  reason: string | null;
  changedByUsername: string | null;
  createdAt: string; // ISO
}

export interface DeviceDetail {
  id: string;
  deviceId: string;
  status: DeviceStatusValue;
  registeredAt: string;
  updatedAt: string;
  lastUploadAt: string | null;
  uploadCount: number;
  totalStorageBytes: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  sensorVersion?: string | null;
  firmwareVersion?: string | null;
  hardwareModel?: string | null;
  hasToken?: boolean;
}

export interface DeviceDetailResponse {
  device: DeviceDetail;
  recentUploads: UploadSummaryItem[];
  recentStatusEvents: DeviceStatusEventItem[];
}

export interface DeviceStatsResponse {
  total: number;
  active: number;
  deactive: number;
}
