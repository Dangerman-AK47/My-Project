"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  KeyRound,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { DeviceStatusBadge } from "./device-status-badge";
import { DeviceStatusControl } from "./device-status-control";
import { ConfirmStatusDialog } from "./confirm-status-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";
import type { DeviceDetailResponse, DeviceStatusValue } from "@/lib/admin/devices-types";

export interface SensorDetailViewProps {
  initialData: DeviceDetailResponse;
}

export function SensorDetailView({ initialData }: SensorDetailViewProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [device, setDevice] = useState(initialData.device);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmStatusDialogOpen, setConfirmStatusDialogOpen] = useState(false);

  // Delete state
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Token state
  const [tokenLoading, setTokenLoading] = useState(false);

  async function handleToggleStatus() {
    const nextStatus: DeviceStatusValue = device.status === "ACTIVE" ? "DEACTIVE" : "ACTIVE";
    if (nextStatus === "DEACTIVE") {
      setConfirmStatusDialogOpen(true);
      return;
    }
    await executeStatusChange("ACTIVE");
  }

  async function executeStatusChange(nextStatus: DeviceStatusValue) {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/admin/sensors/${device.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      setDevice((prev) => ({ ...prev, status: nextStatus, updatedAt: data.device.updatedAt }));
      showToast({
        variant: "success",
        title: "Status updated",
        message: `${device.deviceId} is now ${nextStatus === "ACTIVE" ? "active" : "deactive"}.`,
      });
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to update status.",
      });
    } finally {
      setStatusUpdating(false);
      setConfirmStatusDialogOpen(false);
    }
  }

  async function handleRevokeToken() {
    if (!confirm("Are you sure you want to revoke this sensor's token? The sensor will immediately lose API access.")) {
      return;
    }
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/admin/sensors/${device.id}/token`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke token.");

      setDevice((prev) => ({ ...prev, hasToken: false }));
      showToast({
        variant: "success",
        title: "Token Revoked",
        message: "The sensor's token has been revoked.",
      });
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to revoke token.",
      });
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleDeleteSensor() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/sensors/${device.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete sensor.");

      showToast({
        variant: "success",
        title: "Sensor Deleted",
        message: `Sensor ${device.deviceId} has been permanently deleted.`,
      });
      setConfirmDeleteDialogOpen(false);
      router.push("/admin/sensors");
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to delete sensor.",
      });
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sensors"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent-600" />
              Sensor: {device.deviceId}
            </h1>
            <p className="text-xs text-slate-500">Database ID: {device.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DeviceStatusBadge status={device.status} />
          <DeviceStatusControl
            status={device.status}
            isUpdating={statusUpdating}
            onToggle={handleToggleStatus}
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirmDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Sensor
          </Button>
        </div>
      </div>

      {/* Grid: Overview & Token & Telemetry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overview */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Sensor Overview
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd><DeviceStatusBadge status={device.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Registered</dt>
              <dd className="font-medium text-slate-800">
                {formatUploadTimestamp(new Date(device.registeredAt)).dateLabel}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last Upload</dt>
              <dd className="font-medium text-slate-800">
                {device.lastUploadAt ? formatUploadTimestamp(new Date(device.lastUploadAt)).dateLabel : "Never"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Upload Count</dt>
              <dd className="font-medium text-slate-800">{device.uploadCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Storage Used</dt>
              <dd className="font-medium text-slate-800">{formatFileSize(Number(device.totalStorageBytes))}</dd>
            </div>
          </dl>
        </Card>

        {/* Telemetry */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Telemetry & Identification
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">First Seen</dt>
              <dd className="font-medium text-slate-800">
                {device.firstSeenAt ? formatUploadTimestamp(new Date(device.firstSeenAt)).combined : "Never"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last Seen</dt>
              <dd className="font-medium text-slate-800">
                {device.lastSeenAt ? formatUploadTimestamp(new Date(device.lastSeenAt)).combined : "Never"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Sensor Version</dt>
              <dd className="font-medium text-slate-800">{device.sensorVersion || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Firmware Version</dt>
              <dd className="font-medium text-slate-800">{device.firmwareVersion || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Hardware Model</dt>
              <dd className="font-medium text-slate-800">{device.hardwareModel || "—"}</dd>
            </div>
          </dl>
        </Card>

        {/* Token Management */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
              <span>Sensor API Token</span>
              {device.hasToken ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="neutral">Not Issued</Badge>
              )}
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              {device.hasToken
                ? "This sensor has an active bearer token issued during registration for authenticating version checks, heartbeats, and downloads."
                : "No active token on record. Tokens are automatically issued when sensors register."}
            </p>
          </div>
          <div>
            {device.hasToken ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="w-full"
                disabled={tokenLoading}
                onClick={handleRevokeToken}
              >
                <KeyRound className="h-4 w-4 mr-1.5" />
                Revoke Token
              </Button>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Sensor must re-register to receive a new token.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Uploads and History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Uploads</h2>
          {initialData.recentUploads.length === 0 ? (
            <p className="text-sm text-slate-500">No uploads recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {initialData.recentUploads.map((up) => (
                <li key={up.id} className="py-2 flex items-center justify-between">
                  <span className="font-medium text-slate-800">{up.originalFileName}</span>
                  <span className="text-xs text-slate-500">{formatFileSize(up.fileSizeBytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Status Event History</h2>
          {initialData.recentStatusEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No status changes recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {initialData.recentStatusEvents.map((ev) => (
                <li key={ev.id} className="py-2">
                  <p className="text-slate-800">
                    {ev.previousStatus ?? "—"} &rarr; <span className="font-semibold">{ev.newStatus}</span>
                    {ev.changedByUsername && <span className="text-slate-500"> by {ev.changedByUsername}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatUploadTimestamp(new Date(ev.createdAt)).combined}
                    {ev.reason && ` • ${ev.reason}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmStatusDialog
        open={confirmStatusDialogOpen}
        deviceId={device.deviceId}
        nextStatus="DEACTIVE"
        onCancel={() => setConfirmStatusDialogOpen(false)}
        onConfirm={() => executeStatusChange("DEACTIVE")}
        isSubmitting={statusUpdating}
      />

      <ConfirmDeleteDialog
        open={confirmDeleteDialogOpen}
        deviceId={device.deviceId}
        onCancel={() => setConfirmDeleteDialogOpen(false)}
        onConfirm={handleDeleteSensor}
        isSubmitting={deleteLoading}
      />
    </div>
  );
}
