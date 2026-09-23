export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 flex-1 rounded bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div
      className="flex animate-pulse items-center gap-4 rounded-lg border border-slate-200 bg-white p-5"
      role="status"
      aria-label="Loading"
    >
      <div className="h-10 w-10 rounded-lg bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-5 w-12 rounded bg-slate-200" />
      </div>
    </div>
  );
}
