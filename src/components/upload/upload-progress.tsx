export interface UploadProgressProps {
  percent: number;
}

export function UploadProgress({ percent }: UploadProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Uploading&hellip;</span>
        <span>{clamped}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-accent-500 transition-[width] duration-150"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
