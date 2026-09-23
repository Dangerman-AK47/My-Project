"use client";

import { useState, useEffect } from "react";
import { BarChart3, Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DailySummaryItem {
  date: string;
  activeSensors: number;
  deactiveSensors: number;
  uniqueSensors: number;
  resultBreakdown: Record<string, number>;
}

export function VersionCheckMetricsView() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const [from, setFrom] = useState(sevenDaysAgoStr);
  const [to, setTo] = useState(todayStr);
  const [data, setData] = useState<DailySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadMetrics(fromDate = from, toDate = to) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/version-check-metrics?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.dailySummary || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setQuickRange(days: number) {
    const end = new Date();
    const start = new Date();
    if (days > 1) start.setDate(start.getDate() - (days - 1));
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    setFrom(startStr);
    setTo(endStr);
    void loadMetrics(startStr, endStr);
  }

  const totalActiveSensors = data.reduce((sum, d) => sum + d.activeSensors, 0);
  const totalDeactiveSensors = data.reduce((sum, d) => sum + d.deactiveSensors, 0);
  const totalUniqueSensors = data.reduce((sum, d) => sum + d.uniqueSensors, 0);
  const totalChecks = data.reduce(
    (sum, d) =>
      sum +
      Object.values(d.resultBreakdown).reduce((s, count) => s + count, 0),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent-600" />
          Version Check Metrics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor sensor version checks, update availability, and active vs. deactive telemetry over time.
        </p>
      </div>

      {/* Date Range Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              Date Range:
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 text-xs w-36"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 text-xs w-36"
              />
              <Button
                size="sm"
                variant="primary"
                className="h-8 px-3 text-xs"
                onClick={() => loadMetrics()}
                disabled={loading}
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => setQuickRange(1)}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => setQuickRange(7)}
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => setQuickRange(30)}
            >
              Last 30 Days
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Check Events</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalChecks}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Unique Sensor-Days</p>
          <p className="mt-2 text-2xl font-bold text-accent-600">{totalUniqueSensors}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Active Sensors</p>
          <p className="mt-2 text-2xl font-bold text-success-600">{totalActiveSensors}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Deactivated Sensors</p>
          <p className="mt-2 text-2xl font-bold text-danger-600">{totalDeactiveSensors}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Daily Version Check Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of sensor counts and version-check responses per day.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent-600 mb-2" />
            <p className="text-sm font-medium">Loading metrics...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-medium">No version-check events in this date range</p>
            <p className="text-xs text-slate-400 mt-1">
              Events are recorded when sensors call POST /api/v1/sensors/version-check.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Unique Sensors</th>
                  <th className="py-3 px-4">Active</th>
                  <th className="py-3 px-4">Deactive</th>
                  <th className="py-3 px-4">Current</th>
                  <th className="py-3 px-4">Update Available</th>
                  <th className="py-3 px-4">Deactivated</th>
                  <th className="py-3 px-4">No Config</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{row.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{row.uniqueSensors}</td>
                    <td className="py-3 px-4">
                      <Badge variant="success">{row.activeSensors} active</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {row.deactiveSensors > 0 ? (
                        <Badge variant="danger">{row.deactiveSensors} deactive</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-success-700 font-medium">
                      {row.resultBreakdown["CURRENT"] || 0}
                    </td>
                    <td className="py-3 px-4 text-warning-700 font-medium">
                      {row.resultBreakdown["UPDATE_AVAILABLE"] || 0}
                    </td>
                    <td className="py-3 px-4 text-danger-700 font-medium">
                      {row.resultBreakdown["SENSOR_DEACTIVATED"] || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {row.resultBreakdown["NO_CONFIGURATION_AVAILABLE"] || 0}
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
