"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DeviceRegistrationDialogProps {
  open: boolean;
  deviceId: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeviceRegistrationDialog({
  open,
  deviceId,
  isSubmitting,
  onCancel,
  onConfirm,
}: DeviceRegistrationDialogProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="device-registration-dialog-title"
        aria-describedby="device-registration-dialog-description"
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-card outline-none"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-500" aria-hidden="true" />
          <div>
            <h2 id="device-registration-dialog-title" className="text-base font-semibold text-slate-900">
              Sensor not registered
            </h2>
            <p id="device-registration-dialog-description" className="mt-1.5 text-sm text-slate-600">
              Sensor ID <span className="font-semibold text-slate-900">{deviceId}</span> is not registered yet.
              Only registered sensors can upload files, check versions, and download configurations.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Only this Sensor ID is required. Registration will be <strong>automatically approved</strong> immediately.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Register & Auto-Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
