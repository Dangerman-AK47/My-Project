"use client";

import Link from "next/link";
import { Eye, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceStatusBadge } from "./device-status-badge";
import { DeviceStatusControl } from "./device-status-control";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";
import type { DeviceListItem } from "@/lib/admin/devices-types";

export interface DeviceTableProps {
  devices: DeviceListItem[];
  statusUpdatingId: string | null;
  onToggleStatus: (device: DeviceListItem) => void;
  onViewDetails: (deviceRowId: string) => void;
}

export function DeviceTable({ devices, statusUpdatingId, onToggleStatus, onViewDetails }: DeviceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Sensor ID</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Token</th>
            <th className="px-4 py-3">Registered</th>
            <th className="px-4 py-3">Last upload</th>
            <th className="px-4 py-3">Uploads</th>
            <th className="px-4 py-3">Storage used</th>
            <th className="px-4 py-3">Last activity</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {devices.map((device) => (
            <tr key={device.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link
                  href={`/admin/sensors/${device.id}`}
                  className="text-accent-600 hover:text-accent-700 hover:underline"
                >
                  {device.deviceId}
                </Link>
              </td>
              <td className="px-4 py-3">
                <DeviceStatusBadge status={device.status} />
              </td>
              <td className="px-4 py-3 text-xs">
                {device.hasToken ? (
                  <span className="inline-flex items-center gap-1 font-medium text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                    <KeyRound className="h-3 w-3" /> Issued
                  </span>
                ) : (
                  <span className="text-slate-400">None</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatUploadTimestamp(new Date(device.registeredAt)).dateLabel}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {device.lastUploadAt
                  ? formatUploadTimestamp(new Date(device.lastUploadAt)).dateLabel
                  : "Never"}
              </td>
              <td className="px-4 py-3 text-slate-600">{device.uploadCount}</td>
              <td className="px-4 py-3 text-slate-600">
                {formatFileSize(Number(device.totalStorageBytes))}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatUploadTimestamp(new Date(device.lastActivity)).dateLabel}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <DeviceStatusControl
                    status={device.status}
                    isUpdating={statusUpdatingId === device.id}
                    onToggle={() => onToggleStatus(device)}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => onViewDetails(device.id)}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only sm:ml-1.5">Quick view</span>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
