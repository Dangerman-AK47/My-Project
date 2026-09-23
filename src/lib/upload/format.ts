// Pure formatting helpers — safe to import from both server and client
// code (no "server-only" imports, no Node built-ins).

/** Formats a sequence number as the human-facing upload ID, e.g. "UP-000001". */
export function formatUploadId(sequenceNumber: number): string {
  return `UP-${String(sequenceNumber).padStart(6, "0")}`;
}

/** Formats a byte count as a short human-readable size, e.g. "2.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Formats a date as "September 17, 2026" / "11:49 PM" / the combined form. */
export function formatUploadTimestamp(date: Date): {
  dateLabel: string;
  timeLabel: string;
  combined: string;
  date: string;
} {
  const dateLabel = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const shortDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { dateLabel, timeLabel, combined: `${dateLabel} at ${timeLabel}`, date: shortDate };
}
