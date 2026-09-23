import type { Metadata } from "next";
import { listGlobalConfigs } from "@/lib/services/sensor-configs";
import { GlobalConfigView, type GlobalConfigItem } from "@/components/admin/global-config-view";

export const metadata: Metadata = {
  title: "Configuration Settings — Sensor Platform Admin",
};

export default async function ConfigsOverviewPage() {
  const rawConfigs = await listGlobalConfigs();

  const configs: GlobalConfigItem[] = rawConfigs.map((c) => ({
    id: c.id,
    configVersion: c.configVersion,
    status: c.status,
    originalFileName: c.originalFileName,
    fileSizeBytes: c.fileSizeBytes,
    createdAt: c.createdAt.toISOString(),
    activatedAt: c.activatedAt?.toISOString() ?? null,
    uploadedByAdmin: c.uploadedByAdmin ? { username: c.uploadedByAdmin.username } : null,
    activatedByAdmin: c.activatedByAdmin ? { username: c.activatedByAdmin.username } : null,
  }));

  return <GlobalConfigView initialConfigs={configs} />;
}
