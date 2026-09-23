// Shared request/response shapes for the public upload API, imported by
// both the route handlers (server) and the upload form (client). Contains
// only plain types — no server-only or Node-specific imports.

export interface UploadSuccessData {
  uploadId: string; // e.g. "UP-000001"
  deviceId: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  /** ISO 8601 timestamp */
  uploadedAt: string;
}

export type UploadFieldErrors = Partial<Record<"deviceId" | "file", string>>;

export type UploadApiResponse =
  | { status: "success"; data: UploadSuccessData }
  | { status: "device_not_registered"; deviceId: string; message: string }
  | { status: "device_disabled"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: UploadFieldErrors }
  | { status: "error"; message: string };

export type DeviceRequestFieldErrors = Partial<Record<"deviceId", string>>;

export type DeviceRequestApiResponse =
  | { status: "submitted"; message: string }
  | { status: "already_pending"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: DeviceRequestFieldErrors }
  | { status: "error"; message: string };
