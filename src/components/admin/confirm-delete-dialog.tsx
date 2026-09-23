"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  deviceId: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  deviceId,
  onCancel,
  onConfirm,
  isSubmitting,
}: ConfirmDeleteDialogProps) {
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
        aria-labelledby="confirm-delete-dialog-title"
        aria-describedby="confirm-delete-dialog-description"
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-card outline-none"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" aria-hidden="true" />
          <div>
            <h2 id="confirm-delete-dialog-title" className="text-base font-semibold text-slate-900">
              Permanently delete sensor?
            </h2>
            <p id="confirm-delete-dialog-description" className="mt-1.5 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{deviceId}</span>?
              This action is permanent and cannot be undone. Its API token will be revoked immediately.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={isSubmitting}
          >
            Permanently Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
