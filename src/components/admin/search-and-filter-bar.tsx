"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DeviceSortField, DeviceStatusFilter, SortDirection } from "@/lib/admin/devices-types";

export interface SearchAndFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: DeviceStatusFilter;
  onStatusFilterChange: (value: DeviceStatusFilter) => void;
  sortBy: DeviceSortField;
  sortDir: SortDirection;
  onSortChange: (sortBy: DeviceSortField, sortDir: SortDirection) => void;
}

const SORT_OPTIONS: Array<{
  value: string;
  label: string;
  sortBy: DeviceSortField;
  sortDir: SortDirection;
}> = [
  { value: "registeredAt-desc", label: "Newest registered", sortBy: "registeredAt", sortDir: "desc" },
  { value: "registeredAt-asc", label: "Oldest registered", sortBy: "registeredAt", sortDir: "asc" },
  { value: "uploadCount-desc", label: "Most uploads", sortBy: "uploadCount", sortDir: "desc" },
  { value: "uploadCount-asc", label: "Fewest uploads", sortBy: "uploadCount", sortDir: "asc" },
  { value: "lastActivity-desc", label: "Most recently active", sortBy: "lastActivity", sortDir: "desc" },
  { value: "lastActivity-asc", label: "Least recently active", sortBy: "lastActivity", sortDir: "asc" },
];

export function SearchAndFilterBar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  sortDir,
  onSortChange,
}: SearchAndFilterBarProps) {
  const currentSortValue = `${sortBy}-${sortDir}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by Sensor ID"
          aria-label="Search by Sensor ID"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="device-status-filter">
          Filter by status
        </label>
        <select
          id="device-status-filter"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as DeviceStatusFilter)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DEACTIVE">Deactive</option>
        </select>

        <label className="sr-only" htmlFor="device-sort-select">
          Sort by
        </label>
        <select
          id="device-sort-select"
          value={currentSortValue}
          onChange={(event) => {
            const option = SORT_OPTIONS.find((candidate) => candidate.value === event.target.value);
            if (option) onSortChange(option.sortBy, option.sortDir);
          }}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
