import { Card } from "@/components/ui/card";
import { StatCardSkeleton } from "@/components/admin/skeletons";

export default function VersionCheckMetricsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
