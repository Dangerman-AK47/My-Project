import type { Metadata } from "next";
import { SensorPortalView } from "@/components/portal/sensor-portal-view";

export const metadata: Metadata = {
  title: "Sensor Portal — Sensor Platform",
};

export default function PortalPage() {
  return <SensorPortalView />;
}
