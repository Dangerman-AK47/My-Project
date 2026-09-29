"use client";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

/** Invisible client component — causes the dashboard server data to refresh every 30s */
export function DashboardRefresh() {
  useAutoRefresh(30000);
  return null;
}
