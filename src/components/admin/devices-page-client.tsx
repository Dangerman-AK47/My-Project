"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ErrorAlert } from "@/components/upload/error-alert";
import { SearchAndFilterBar } from "./search-and-filter-bar";
import { DeviceTable } from "./device-table";
import { Pagination } from "./pagination";
import { ConfirmStatusDialog } from "./confirm-status-dialog";
import { DeviceDetailsDialog } from "./device-details-dialog";
import { TableSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import type {
  DeviceListItem,
  DeviceListResponse,
  DeviceSortField,
  DeviceStatusFilter,
  DeviceStatusValue,
  SortDirection,
} from "@/lib/admin/devices-types";

const SEARCH_DEBOUNCE_MS = 350;

export interface DevicesPageClientProps {
  initialData: DeviceListResponse;
}

export function DevicesPageClient({ initialData }: DevicesPageClientProps) {
  const { showToast } = useToast();

  const [devices, setDevices] = useState<DeviceListItem[]>(initialData.devices);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(initialData.page);
  const pageSize = initialData.pageSize;

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<DeviceSortField>("registeredAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<{
    device: DeviceListItem;
    nextStatus: DeviceStatusValue;
  } | null>(null);
  const [detailsRowId, setDetailsRowId] = useState<string | null>(null);

  const didMountRef = useRef(false);

  const fetchDevices = useCallback(
    async (params: {
      search: string;
      status: DeviceStatusFilter;
      sortBy: DeviceSortField;
      sortDir: SortDirection;
      page: number;
    }) => {
      setLoading(true);
      setError(undefined);
      try {
        const url = new URL("/api/admin/sensors", window.location.origin);
        if (params.search) url.searchParams.set("q", params.search);
        if (params.status !== "ALL") url.searchParams.set("status", params.status);
        url.searchParams.set("sortBy", params.sortBy);
        url.searchParams.set("sortDir", params.sortDir);
        url.searchParams.set("page", String(params.page));
        url.searchParams.set("pageSize", String(pageSize));

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to load sensors.");
        const json = (await response.json()) as DeviceListResponse;
        setDevices(json.devices);
        setTotal(json.total);
        setPage(json.page);
      } catch {
        setError("Could not load sensors. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAppliedSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    fetchDevices({ search: appliedSearch, status: statusFilter, sortBy, sortDir, page });
  }, [appliedSearch, statusFilter, sortBy, sortDir, page, fetchDevices]);

  function handleStatusFilterChange(value: DeviceStatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleSortChange(nextSortBy: DeviceSortField, nextSortDir: SortDirection) {
    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
    setPage(1);
  }

  async function applyStatusChange(device: DeviceListItem, nextStatus: DeviceStatusValue) {
    setStatusUpdatingId(device.id);
    try {
      const response = await fetch(`/api/admin/sensors/${device.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Failed to update sensor status.");
      }

      setDevices((current) =>
        current.map((item) =>
          item.id === device.id
            ? { ...item, status: nextStatus, updatedAt: json.device.updatedAt, lastActivity: json.device.updatedAt }
            : item
        )
      );
      showToast({
        variant: "success",
        title: "Status updated",
        message: `${device.deviceId} is now ${nextStatus === "ACTIVE" ? "active" : "deactive"}.`,
      });
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to update sensor status.",
      });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function handleToggleRequest(device: DeviceListItem) {
    const nextStatus: DeviceStatusValue = device.status === "ACTIVE" ? "DEACTIVE" : "ACTIVE";
    if (nextStatus === "DEACTIVE") {
      setConfirmTarget({ device, nextStatus });
    } else {
      void applyStatusChange(device, nextStatus);
    }
  }

  function handleConfirmDisable() {
    if (!confirmTarget) return;
    void applyStatusChange(confirmTarget.device, confirmTarget.nextStatus);
    setConfirmTarget(null);
  }

  function handleCancelConfirm() {
    setConfirmTarget(null);
  }

  const noResultsReason =
    appliedSearch || statusFilter !== "ALL"
      ? "No sensors match your search or filters."
      : "No sensors have been registered yet.";

  return (
    <div className="flex flex-col gap-4">
      <SearchAndFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
      />

      {error && <ErrorAlert message={error} />}

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={pageSize} columns={8} />
        ) : devices.length === 0 ? (
          <EmptyState message={noResultsReason} icon={Activity} />
        ) : (
          <DeviceTable
            devices={devices}
            statusUpdatingId={statusUpdatingId}
            onToggleStatus={handleToggleRequest}
            onViewDetails={setDetailsRowId}
          />
        )}
      </Card>

      {!loading && devices.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}

      <ConfirmStatusDialog
        open={Boolean(confirmTarget)}
        deviceId={confirmTarget?.device.deviceId ?? ""}
        nextStatus={confirmTarget?.nextStatus ?? "DEACTIVE"}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirmDisable}
      />

      <DeviceDetailsDialog deviceRowId={detailsRowId} onClose={() => setDetailsRowId(null)} />
    </div>
  );
}
