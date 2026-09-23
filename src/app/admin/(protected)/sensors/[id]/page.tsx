import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDeviceDetail } from "@/lib/services/device-queries";
import { SensorDetailView } from "@/components/admin/sensor-detail-view";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getDeviceDetail(params.id);
  if (!detail) {
    return { title: "Sensor Not Found — Sensor Platform Admin" };
  }
  return {
    title: `${detail.device.deviceId} — Sensor Platform Admin`,
  };
}

export default async function SensorDetailPage({ params }: Props) {
  const detail = await getDeviceDetail(params.id);
  if (!detail) {
    notFound();
  }

  return <SensorDetailView initialData={detail} />;
}
