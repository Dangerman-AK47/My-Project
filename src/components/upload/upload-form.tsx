"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { deviceIdSchema } from "@/lib/validation/device-id";
import { uploadFileWithProgress, UploadAbortedError } from "@/lib/upload/client";
import type { DeviceRequestApiResponse, UploadApiResponse, UploadSuccessData } from "@/lib/upload/types";
import { FileDropzone } from "./file-dropzone";
import { UploadProgress } from "./upload-progress";
import { UploadSuccessPanel } from "./upload-success-panel";
import { DeviceRegistrationDialog } from "./device-registration-dialog";
import { ErrorAlert } from "./error-alert";

type Phase = "idle" | "uploading" | "submitting_request" | "success";

export interface UploadFormProps {
  maxFileSizeMB: number;
}

export function UploadForm({ maxFileSizeMB }: UploadFormProps) {
  const { showToast } = useToast();

  const [deviceId, setDeviceId] = useState("");
  const [deviceIdError, setDeviceIdError] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [successData, setSuccessData] = useState<UploadSuccessData | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function validate(): { deviceId: string; file: File } | null {
    let valid = true;
    let normalizedDeviceId = "";

    const deviceIdResult = deviceIdSchema.safeParse(deviceId);
    if (!deviceIdResult.success) {
      setDeviceIdError(deviceIdResult.error.issues[0]?.message);
      valid = false;
    } else {
      setDeviceIdError(undefined);
      normalizedDeviceId = deviceIdResult.data;
    }

    if (!file) {
      setFileError("Please select a file to upload.");
      valid = false;
    } else if (file.size <= 0) {
      setFileError("The selected file is empty.");
      valid = false;
    } else if (file.size > maxFileSizeMB * 1024 * 1024) {
      setFileError(`File exceeds the ${maxFileSizeMB} MB limit.`);
      valid = false;
    } else {
      setFileError(undefined);
    }

    return valid ? { deviceId: normalizedDeviceId, file: file! } : null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    const validated = validate();
    if (!validated) return;

    setPhase("uploading");
    setProgress(0);

    try {
      const result = await uploadFileWithProgress(
        validated.deviceId,
        validated.file,
        setProgress,
        (xhr) => {
          xhrRef.current = xhr;
        }
      );
      handleUploadResult(result);
    } catch (err) {
      setPhase("idle");
      if (err instanceof UploadAbortedError) {
        showToast({ variant: "info", message: "Upload canceled." });
      } else {
        setFormError("Something went wrong while uploading. Please try again.");
        showToast({ variant: "error", message: "Upload failed. Please try again." });
      }
    } finally {
      xhrRef.current = null;
    }
  }

  function handleUploadResult(result: UploadApiResponse) {
    switch (result.status) {
      case "success":
        setSuccessData(result.data);
        setPhase("success");
        showToast({ variant: "success", title: "Upload complete", message: "File uploaded successfully." });
        return;

      case "device_disabled":
        setPhase("idle");
        setFormError(result.message);
        showToast({ variant: "error", message: result.message });
        return;

      case "device_not_registered":
        setPhase("idle");
        setPendingDeviceId(result.deviceId);
        setDialogOpen(true);
        return;

      case "validation_error":
        setPhase("idle");
        if (result.fieldErrors?.deviceId) setDeviceIdError(result.fieldErrors.deviceId);
        if (result.fieldErrors?.file) setFileError(result.fieldErrors.file);
        if (!result.fieldErrors) setFormError(result.message);
        return;

      case "error":
      default:
        setPhase("idle");
        setFormError(result.message);
        showToast({ variant: "error", message: result.message });
    }
  }

  function handleCancelUpload() {
    xhrRef.current?.abort();
  }

  function handleReset() {
    setDeviceId("");
    setFile(null);
    setDeviceIdError(undefined);
    setFileError(undefined);
    setFormError(undefined);
    setPhase("idle");
    setSuccessData(null);
    setProgress(0);
  }

  async function handleConfirmRegistration() {
    if (!pendingDeviceId) return;
    setPhase("submitting_request");

    try {
      const response = await fetch("/api/device-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: pendingDeviceId }),
      });
      const json = (await response.json()) as DeviceRequestApiResponse;

      if (json.status === "submitted") {
        showToast({ variant: "success", title: "Request submitted", message: json.message });
      } else if (json.status === "already_pending") {
        showToast({ variant: "info", title: "Request already pending", message: json.message });
      } else {
        showToast({ variant: "error", message: json.message });
      }
    } catch {
      showToast({
        variant: "error",
        message: "Something went wrong submitting your request. Please try again.",
      });
    } finally {
      setDialogOpen(false);
      setPendingDeviceId(null);
      setPhase("idle");
    }
  }

  function handleCancelDialog() {
    // Per spec: closes the modal, does not upload the file, does not
    // create a request. Nothing to do here beyond closing the dialog —
    // no network call has been made at this point.
    setDialogOpen(false);
    setPendingDeviceId(null);
  }

  if (phase === "success" && successData) {
    return <UploadSuccessPanel data={successData} onUploadAnother={handleReset} />;
  }

  const isUploading = phase === "uploading";

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && <ErrorAlert message={formError} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deviceId">Device ID</Label>
          <Input
            id="deviceId"
            name="deviceId"
            type="text"
            autoComplete="off"
            placeholder="e.g. DEV-1001"
            value={deviceId}
            disabled={isUploading}
            invalid={Boolean(deviceIdError)}
            aria-describedby={deviceIdError ? "deviceId-error" : undefined}
            onChange={(event) => {
              setDeviceId(event.target.value);
              if (deviceIdError) setDeviceIdError(undefined);
            }}
          />
          {deviceIdError && (
            <p id="deviceId-error" className="text-xs text-danger-500">
              {deviceIdError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file-upload">File</Label>
          <FileDropzone
            id="file-upload"
            file={file}
            disabled={isUploading}
            error={fileError}
            onFileSelected={(selected) => {
              setFile(selected);
              if (fileError) setFileError(undefined);
            }}
          />
        </div>

        {isUploading && <UploadProgress percent={progress} />}

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" loading={isUploading} disabled={isUploading}>
            {isUploading ? "Uploading" : "Upload"}
          </Button>
          {isUploading ? (
            <Button type="button" variant="secondary" onClick={handleCancelUpload}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>
      </form>

      <DeviceRegistrationDialog
        open={dialogOpen}
        deviceId={pendingDeviceId ?? ""}
        isSubmitting={phase === "submitting_request"}
        onCancel={handleCancelDialog}
        onConfirm={handleConfirmRegistration}
      />
    </>
  );
}
