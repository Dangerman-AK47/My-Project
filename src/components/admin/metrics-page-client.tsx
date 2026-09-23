"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Search, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface MetricItem {
  id: string;
  deviceId: string;
  date: string;
  result:
    | "CURRENT"
    | "UPDATE_AVAILABLE"
    | "SENSOR_DEACTIVATED"
    | "NO_CONFIGURATION_AVAILABLE"
    | "INVALID_VERSION"
    | "SENSOR_NOT_REGISTERED";
  count: number;
  updatedAt: string;
}

export interface MetricsPageClientProps {
  initialMetrics: MetricItem[];
}

const RESULT_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  CURRENT: "success",
  UPDATE_AVAILABLE: "warning",
  SENSOR_DEACTIVATED: "danger",
  NO_CONFIGURATION_AVAILABLE: "neutral",
  INVALID_VERSION: "danger",
  SENSOR_NOT_REGISTERED: "danger",
};

export function MetricsPageClient({ initialMetrics }: MetricsPageClientProps) {
  const [metrics] = useState<MetricItem[]>(initialMetrics);
  const [filterResult, setFilterResult] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = metrics.filter((m) => {
    if (filterResult !== "ALL" && m.result !== filterResult) return false;
    if (search && !m.deviceId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalChecks = metrics.reduce((sum, m) => sum + m.count, 0);
  const currentChecks = metrics.filter((m) => m.result === "CURRENT").reduce((s, m) => s + m.count, 0);
  const updateAvailableChecks = metrics.filter((m) => m.result === "UPDATE_AVAILABLE").reduce((s, m) => s + m.count, 0);
  const deactivatedChecks = metrics.filter((m) => m.result === "SENSOR_DEACTIVATED").reduce((s, m) => s + m.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent-600" />
          Version Check Metrics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daily aggregated telemetry of sensor configuration checks and update availability.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Checks</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalChecks}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Up to Date (Current)</p>
          <p className="mt-2 text-2xl font-bold text-success-600">{currentChecks}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Update Available</p>
          <p className="mt-2 text-2xl font-bold text-warning-600">{updateAvailableChecks}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Deactivated Checks</p>
          <p className="mt-2 text-2xl font-bold text-danger-600">{deactivatedChecks}</p>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Filter by Sensor ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="ALL">All Results</option>
          <option value="CURRENT">CURRENT</option>
          <option value="UPDATE_AVAILABLE">UPDATE_AVAILABLE</option>
          <option value="SENSOR_DEACTIVATED">SENSOR_DEACTIVATED</option>
          <option value="NO_CONFIGURATION_AVAILABLE">NO_CONFIGURATION_AVAILABLE</option>
          <option value="INVALID_VERSION">INVALID_VERSION</option>
          <option value="SENSOR_NOT_REGISTERED">SENSOR_NOT_REGISTERED</option>
        </select>
      </div>

      {/* Metrics Table */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-medium">No version check events recorded</p>
            <p className="text-xs text-slate-400 mt-1">
              Events will appear here as sensors call the /api/sensor/version-check endpoint.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Sensor ID</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Check Count</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-slate-700">{m.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span>{m.deviceId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={RESULT_BADGE[m.result] || "neutral"}>{m.result}</Badge>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.count}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/admin/sensors`}
                        className="text-xs text-accent-600 hover:text-accent-700 hover:underline font-medium"
                      >
                        View sensor
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
