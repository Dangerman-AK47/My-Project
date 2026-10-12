import { Card } from "@/components/ui/card";

export default function SensorDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((__, j) => (
                <div key={j} className="h-4 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200 mb-3" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="h-6 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
