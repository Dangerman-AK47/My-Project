"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { DeviceStatusBadge } from "./device-status-badge";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";
import type { DeviceDetailResponse } from "@/lib/admin/devices-types";

export interface DeviceDetailsDialogProps {
  /** The sensor's internal row id (RegisteredDevice.id), not its business Device ID. */
  deviceRowId: string | null;
  onClose: () => void;
}

export function DeviceDetailsDialog({ deviceRowId, onClose }: DeviceDetailsDialogProps) {
  const [data, setData] = useState<DeviceDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!deviceRowId) {
      setData(null);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);
    setData(null);

    fetch(`/api/admin/sensors/${deviceRowId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load sensor details.");
        return response.json() as Promise<DeviceDetailResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load sensor details. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deviceRowId]);

  if (!deviceRowId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-details-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-card"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="device-details-title" className="text-base font-semibold text-slate-900">
              Sensor details
            </h2>
            {data && (
              <Link
                href={`/admin/sensors/${data.device.id}`}
                onClick={onClose}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent-500 hover:text-accent-700"
              >
                View full details & configs
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading&hellip;</p>}
        {error && <p className="mt-6 text-sm text-danger-500">{error}</p>}

        {data && (
          <div className="mt-4 flex flex-col gap-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Sensor ID</dt>
              <dd className="font-medium text-slate-900">{data.device.deviceId}</dd>

              <dt className="text-slate-500">Status</dt>
              <dd>
                <DeviceStatusBadge status={data.device.status} />
              </dd>

              <dt className="text-slate-500">Registered</dt>
              <dd className="text-slate-900">
                {formatUploadTimestamp(new Date(data.device.registeredAt)).combined}
              </dd>

              <dt className="text-slate-500">Last upload</dt>
              <dd className="text-slate-900">
                {data.device.lastUploadAt
                  ? formatUploadTimestamp(new Date(data.device.lastUploadAt)).combined
                  : "Never"}
              </dd>

              <dt className="text-slate-500">Upload count</dt>
              <dd className="text-slate-900">{data.device.uploadCount}</dd>

              <dt className="text-slate-500">Storage used</dt>
              <dd className="text-slate-900">{formatFileSize(Number(data.device.totalStorageBytes))}</dd>
            </dl>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent uploads</h3>
              {data.recentUploads.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No uploads yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {data.recentUploads.map((upload) => (
                    <li key={upload.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-slate-800">{upload.originalFileName}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatFileSize(upload.fileSizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Status history</h3>
              {data.recentStatusEvents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No status changes recorded.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {data.recentStatusEvents.map((event) => (
                    <li key={event.id} className="py-2">
                      <p className="text-slate-800">
                        {event.previousStatus ?? "\u2014"} &rarr; {event.newStatus}
                        {event.changedByUsername && (
                          <span className="text-slate-500"> by {event.changedByUsername}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatUploadTimestamp(new Date(event.createdAt)).combined}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
