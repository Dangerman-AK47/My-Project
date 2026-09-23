"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceStatusValue } from "@/lib/admin/devices-types";

export interface ConfirmStatusDialogProps {
  open: boolean;
  deviceId: string;
  nextStatus: DeviceStatusValue;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function ConfirmStatusDialog({
  open,
  deviceId,
  nextStatus,
  onCancel,
  onConfirm,
  isSubmitting,
}: ConfirmStatusDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const isDeactivating = nextStatus === "DEACTIVE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-status-dialog-title"
        aria-describedby="confirm-status-dialog-description"
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-card outline-none"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-500" aria-hidden="true" />
          <div>
            <h2 id="confirm-status-dialog-title" className="text-base font-semibold text-slate-900">
              {isDeactivating ? "Deactivate this sensor?" : "Activate this sensor?"}
            </h2>
            <p id="confirm-status-dialog-description" className="mt-1.5 text-sm text-slate-600">
              {isDeactivating
                ? `${deviceId} will no longer be able to upload files or fetch configurations until reactivated.`
                : `${deviceId} will be able to upload files and fetch configurations again.`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDeactivating ? "danger" : "primary"}
            onClick={onConfirm}
            loading={isSubmitting}
          >
            {isDeactivating ? "Deactivate sensor" : "Activate sensor"}
          </Button>
        </div>
      </div>
    </div>
  );
}
