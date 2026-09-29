import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/admin/skeletons";

export default function FilesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-72 rounded-lg bg-slate-200 animate-pulse" />
      <Card className="overflow-hidden">
        <TableSkeleton rows={20} columns={7} />
      </Card>
    </div>
  );
}
