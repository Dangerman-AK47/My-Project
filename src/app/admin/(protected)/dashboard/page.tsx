import type { Metadata } from "next";
import {
  Activity,
  CheckCircle2,
  Clock,
  FileStack,
  HardDrive,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { RequestStatusBadge } from "@/components/admin/request-status-badge";
import { getDeviceStatusCounts } from "@/lib/services/device-queries";
import { getRequestStatusCounts, listRecentRequests } from "@/lib/services/request-queries";
import {
  getUploadActivityByDay,
  getUploadSummaryStats,
  listRecentUploads,
} from "@/lib/services/upload-queries";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";

export const metadata: Metadata = {
  title: "Overview — Sensor Platform Admin",
};

function StatusDistributionBar({ active, deactive }: { active: number; deactive: number }) {
  const total = active + deactive;
  const activePct = total === 0 ? 0 : Math.round((active / total) * 100);
  const deactivePct = total === 0 ? 0 : 100 - activePct;

  if (total === 0) {
    return <EmptyState message="No sensors have been registered yet." icon={Activity} />;
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-success-500" style={{ width: `${activePct}%` }} />
        <div className="h-full bg-slate-300" style={{ width: `${deactivePct}%` }} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
          Active ({active})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
          Deactive ({deactive})
        </span>
      </div>
    </div>
  );
}

function ActivityBars({ activity, max }: { activity: { date: string; count: number }[]; max: number }) {
  if (activity.every((day) => day.count === 0)) {
    return <EmptyState message="No uploads in the last 7 days." icon={Clock} />;
  }

  return (
    <div className="flex items-end gap-2" role="img" aria-label="Uploads per day over the last 7 days">
      {activity.map((day) => {
        const heightPct = max === 0 ? 0 : Math.max(4, Math.round((day.count / max) * 100));
        const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", {
          weekday: "short",
        });
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t bg-accent-500"
                style={{ height: `${heightPct}%` }}
                title={`${day.count} upload${day.count === 1 ? "" : "s"} on ${day.date}`}
              />
            </div>
            <span className="text-[11px] text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminDashboardOverviewPage() {
  const [deviceCounts, requestCounts, uploadStats, recentUploads, recentRequests, activity] =
    await Promise.all([
      getDeviceStatusCounts(),
      getRequestStatusCounts(),
      getUploadSummaryStats(),
      listRecentUploads(5),
      listRecentRequests(5),
      getUploadActivityByDay(7),
    ]);

  const maxActivityCount = Math.max(1, ...activity.map((day) => day.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total sensors" value={deviceCounts.total} icon={Activity} />
        <StatCard
          label="Active sensors"
          value={deviceCounts.active}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard label="Deactive sensors" value={deviceCounts.deactive} icon={XCircle} accent="neutral" />
        <StatCard
          label="Pending requests"
          value={requestCounts.pending}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Approved requests"
          value={requestCounts.approved}
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard label="Rejected requests" value={requestCounts.rejected} icon={XCircle} accent="danger" />
        <StatCard label="Total files" value={uploadStats.totalFiles} icon={FileStack} />
        <StatCard
          label="Total storage used"
          value={formatFileSize(uploadStats.totalStorageBytes)}
          icon={HardDrive}
        />
        <StatCard
          label="Uploads in last 24h"
          value={uploadStats.last24h}
          icon={Clock}
          accent="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUploads.length === 0 ? (
              <EmptyState message="No files have been uploaded yet." icon={FileStack} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentUploads.map((upload) => (
                  <li key={upload.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{upload.originalFileName}</p>
                      <p className="text-xs text-slate-500">
                        {upload.registeredDevice.deviceId} &middot; {formatFileSize(upload.fileSizeBytes)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatUploadTimestamp(upload.uploadedAt).combined}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent registration requests</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <EmptyState message="No registration requests yet." icon={Clock} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentRequests.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium text-slate-800">{request.deviceId}</span>
                    <RequestStatusBadge status={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sensor status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionBar active={deviceCounts.active} deactive={deviceCounts.deactive} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload activity (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityBars activity={activity} max={maxActivityCount} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
