"use client";

import { useState } from "react";
import { FileText, ShieldAlert, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "./pagination";
import { formatUploadTimestamp } from "@/lib/upload/format";

export interface AuditEventItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  adminUsername: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditPageClientProps {
  initialEvents: AuditEventItem[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

export function AuditPageClient({
  initialEvents,
  initialTotal,
  initialPage,
  pageSize,
}: AuditPageClientProps) {
  const [events] = useState<AuditEventItem[]>(initialEvents);
  const [page, setPage] = useState(initialPage);
  const [actionFilter, setActionFilter] = useState("ALL");

  const filtered = events.filter((e) => {
    if (actionFilter !== "ALL" && e.action !== actionFilter) return false;
    return true;
  });

  const actions = Array.from(new Set(events.map((e) => e.action)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-accent-600" />
          Audit Logs
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Historical record of administrator actions, token issuances, and configuration activations.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="action-filter" className="text-xs font-medium text-slate-600">
            Filter by action:
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="ALL">All Actions</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">Showing {filtered.length} of {initialTotal} events</p>
      </div>

      {/* Audit Events Table */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <ShieldAlert className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-medium">No admin audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Admin</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {formatUploadTimestamp(new Date(e.createdAt)).combined}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{e.adminUsername}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{e.action}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <span className="font-medium text-slate-800">{e.entityType}</span>
                      {e.entityId && (
                        <span className="block font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                          {e.entityId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[280px]">
                      {e.metadata ? (
                        <code className="block rounded bg-slate-100 p-1 text-[11px] text-slate-700 truncate font-mono">
                          {JSON.stringify(e.metadata)}
                        </code>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {initialTotal > pageSize && (
        <Pagination page={page} pageSize={pageSize} total={initialTotal} onPageChange={setPage} />
      )}
    </div>
  );
}
