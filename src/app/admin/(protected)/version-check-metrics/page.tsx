import type { Metadata } from "next";
import { VersionCheckMetricsView } from "@/components/admin/version-check-metrics-view";

export const metadata: Metadata = {
  title: "Version Check Metrics — Sensor Platform Admin",
};

export default function VersionCheckMetricsPage() {
  return <VersionCheckMetricsView />;
}
