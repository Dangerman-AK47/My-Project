"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { RequestStatusBadge, type RequestStatusValue } from "./request-status-badge";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { TableSkeleton } from "./skeletons";
import { formatUploadTimestamp } from "@/lib/upload/format";

export interface RegistrationRequest {
  id: string;
  deviceId: string;
  status: RequestStatusValue;
  submittedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  reviewedByUsername: string | null;
}

export interface RequestsPageClientProps {
  initialRequests: RegistrationRequest[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "AUTO_APPROVED", label: "Auto-Approved" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SEARCH_DEBOUNCE_MS = 350;

export function RequestsPageClient({
  initialRequests,
  initialTotal,
  initialPage,
  pageSize,
}: RequestsPageClientProps) {
  const { showToast } = useToast();

  const [requests, setRequests] = useState<RegistrationRequest[]>(initialRequests);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const didMountRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchRequests = useCallback(
    async (params: { search: string; status: string; page: number }) => {
      setLoading(true);
      try {
        const url = new URL("/api/admin/history", window.location.origin);
        if (params.search) url.searchParams.set("q", params.search);
        if (params.status !== "ALL") url.searchParams.set("status", params.status);
        url.searchParams.set("page", String(params.page));
        url.searchParams.set("pageSize", String(pageSize));
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error();
        const json = await res.json();
        setRequests(json.requests);
        setTotal(json.total);
        setPage(json.page);
      } catch {
        showToast({ variant: "error", message: "Could not load registration history. Please try again." });
      } finally {
        setLoading(false);
      }
    },
    [pageSize, showToast]
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void fetchRequests({ search: appliedSearch, status: statusFilter, page });
  }, [appliedSearch, statusFilter, page, fetchRequests]);

  return (
    <div className="flex flex-col gap-4">
      {/* Informational banner */}
      <div className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50/50 p-3 text-xs text-accent-900">
        <Info className="h-4 w-4 shrink-0 text-accent-600" />
        <span>
          Sensor registration is fully automatic. Sensors register directly via{" "}
          <code className="rounded bg-accent-100/60 px-1 py-0.5 font-mono text-accent-800">
            POST /api/v1/sensors/register
          </code>{" "}
          and are instantly active.
        </span>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Sensor ID…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            aria-label="Search requests by sensor ID"
          />
          <ClipboardList className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={pageSize} columns={5} />
        ) : requests.length === 0 ? (
          <EmptyState
            message={
              appliedSearch || statusFilter !== "ALL"
                ? "No registration records match your search or filters."
                : "No registration records yet."
            }
            icon={ClipboardList}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Sensor ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered / Submitted</th>
                  <th className="px-4 py-3">Reviewed At</th>
                  <th className="px-4 py-3">Reviewer / Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">{req.deviceId}</td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {formatUploadTimestamp(new Date(req.submittedAt)).combined}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {req.reviewedAt
                        ? formatUploadTimestamp(new Date(req.reviewedAt)).combined
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-[250px]">
                      {req.reviewedByUsername && (
                        <span className="font-medium text-slate-800">{req.reviewedByUsername} </span>
                      )}
                      {req.reviewReason ? (
                        <span className="text-slate-500">{req.reviewReason}</span>
                      ) : (
                        !req.reviewedByUsername && <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && requests.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
