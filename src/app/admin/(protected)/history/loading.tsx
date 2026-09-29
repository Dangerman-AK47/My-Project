import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/admin/skeletons";

export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <TableSkeleton rows={15} columns={6} />
      </Card>
    </div>
  );
}
