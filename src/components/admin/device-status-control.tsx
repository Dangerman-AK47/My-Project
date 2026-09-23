"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceStatusValue } from "@/lib/admin/devices-types";

export interface DeviceStatusControlProps {
  status: DeviceStatusValue;
  isUpdating: boolean;
  onToggle: () => void;
}

/**
 * A switch-style control communicating the current active/deactive state.
 */
export function DeviceStatusControl({ status, isUpdating, onToggle }: DeviceStatusControlProps) {
  const isActive = status === "ACTIVE";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? "Deactivate sensor" : "Activate sensor"}
      disabled={isUpdating}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1",
        "disabled:opacity-50",
        isActive ? "bg-success-500" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          isActive ? "translate-x-6" : "translate-x-1"
        )}
      />
      {isUpdating && (
        <Loader2
          className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
