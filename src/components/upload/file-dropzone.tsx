"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { File as FileIcon, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/upload/format";

export interface FileDropzoneProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
}

/**
 * File selection with drag-and-drop, click-to-browse, and full keyboard
 * support. The real <input type="file"> is visually hidden (`sr-only`, not
 * `display:none`) so it stays in the tab order and Enter/Space still opens
 * the native file picker; the visible label is what people see and click.
 */
export function FileDropzone({ file, onFileSelected, disabled, error, id }: FileDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      onFileSelected(fileList?.[0] ?? null);
    },
    [onFileSelected]
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (!disabled) handleFiles(event.dataTransfer.files);
  };

  const handleRemove = () => {
    onFileSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          "focus-within:ring-2 focus-within:ring-accent-500 focus-within:ring-offset-1",
          isDragActive ? "border-accent-500 bg-accent-50" : "border-slate-300 bg-slate-50",
          disabled && "opacity-60",
          error && "border-danger-500"
        )}
      >
        <UploadCloud className="h-8 w-8 text-slate-400" aria-hidden="true" />

        <label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium text-accent-600",
            !disabled && "cursor-pointer hover:text-accent-700"
          )}
        >
          Choose a file
          <input
            ref={inputRef}
            id={inputId}
            name="file"
            type="file"
            className="sr-only"
            disabled={disabled}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
        <p className="text-xs text-slate-500">or drag and drop it here</p>

        {file && (
          <div className="mt-3 flex w-full max-w-sm items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left">
            <div className="flex min-w-0 items-center gap-2">
              <FileIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.size)} &middot; {file.type || "Unknown type"}
                </p>
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Remove selected file"
                className="shrink-0 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}
