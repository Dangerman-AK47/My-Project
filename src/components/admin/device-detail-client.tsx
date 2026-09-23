"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { DeviceStatusBadge } from "./device-status-badge";
import type { DeviceStatusValue } from "@/lib/admin/devices-types";

interface DeviceDetailClientProps {
  device: {
    id: string;
    deviceId: string;
    status: DeviceStatusValue;
    registeredAt: string;
    updatedAt: string;
    lastUploadAt: string | null;
    uploadCount: number;
    totalStorageBytes: string;
  };
}

export function DeviceDetailClient({ device }: DeviceDetailClientProps) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<DeviceStatusValue>(device.status);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function applyStatusChange(nextStatus: DeviceStatusValue) {
    setLoading(true);
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/admin/sensors/${device.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status.");
      setStatus(nextStatus);
      showToast({
        variant: "success",
        title: "Status updated",
        message: `Sensor is now ${nextStatus === "ACTIVE" ? "active" : "deactive"}.`,
      });
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to update sensor status.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (status === "ACTIVE") {
      setShowConfirm(true);
    } else {
      void applyStatusChange("ACTIVE");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <DeviceStatusBadge status={status} />
      <Button
        type="button"
        variant={status === "ACTIVE" ? "secondary" : "primary"}
        size="sm"
        disabled={loading}
        onClick={handleToggle}
      >
        {status === "ACTIVE" ? "Deactivate" : "Activate"}
      </Button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-slate-900">Deactivate sensor?</h3>
            <p className="mt-1 text-sm text-slate-600">
              This sensor will no longer be able to upload files or fetch configurations.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void applyStatusChange("DEACTIVE")}
              >
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
