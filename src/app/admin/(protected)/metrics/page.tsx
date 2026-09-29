import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default function LegacyMetricsPage() {
  redirect("/admin/version-check-metrics");
}
