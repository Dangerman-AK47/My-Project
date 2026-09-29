import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/admin/skeletons";

export default function SensorsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-full max-w-xl rounded-lg bg-slate-200 animate-pulse" />
      <Card className="overflow-hidden">
        <TableSkeleton rows={10} columns={8} />
      </Card>
    </div>
  );
}
