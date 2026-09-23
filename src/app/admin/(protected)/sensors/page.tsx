import type { Metadata } from "next";
import { listDevices } from "@/lib/services/device-queries";
import { DevicesPageClient } from "@/components/admin/devices-page-client";

export const metadata: Metadata = {
  title: "Sensors — Sensor Platform Admin",
};

export default async function AdminSensorsPage() {
  const initialData = await listDevices({
    page: 1,
    pageSize: 10,
    sortBy: "registeredAt",
    sortDir: "desc",
    status: "ALL",
  });

  return <DevicesPageClient initialData={initialData} />;
}
