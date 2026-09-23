"use client";

import { useEffect, useRef, useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RegistrationRequest } from "./requests-page-client";

interface RejectRequestDialogProps {
  request: RegistrationRequest | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectRequestDialog({ request, onClose, onConfirm }: RejectRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (request) {
      setReason("");
      setError("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [request]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && request) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [request, onClose]);

  if (!request) return null;

  function handleSubmit() {
    if (!reason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-100">
            <XCircle className="h-5 w-5 text-danger-600" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="reject-dialog-title" className="text-base font-semibold text-slate-900">
              Reject Registration Request
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Rejecting request for{" "}
              <span className="font-mono font-medium text-slate-800">{request.deviceId}</span>.
              Please provide a reason.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-700">
            Reason <span className="text-danger-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            id="reject-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            rows={3}
            maxLength={500}
            placeholder="Enter rejection reason…"
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          />
          {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
          <p className="mt-1 text-right text-xs text-slate-400">{reason.length}/500</p>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
          >
            Reject Request
          </Button>
        </div>
      </div>
    </div>
  );
}
