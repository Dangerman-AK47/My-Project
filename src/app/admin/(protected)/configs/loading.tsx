import { Card } from "@/components/ui/card";

export default function ConfigsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-64 rounded bg-slate-200 animate-pulse" />
      <Card className="h-32 animate-pulse bg-slate-50" />
      <Card className="h-24 animate-pulse bg-slate-50" />
      <Card className="overflow-hidden">
        <div className="animate-pulse space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-100" />
          ))}
        </div>
      </Card>
    </div>
  );
}
