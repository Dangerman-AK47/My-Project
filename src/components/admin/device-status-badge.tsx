import { Badge } from "@/components/ui/badge";
import type { DeviceStatusValue } from "@/lib/admin/devices-types";

const VARIANT: Record<DeviceStatusValue, "success" | "neutral"> = {
  ACTIVE: "success",
  DEACTIVE: "neutral",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatusValue }) {
  return <Badge variant={VARIANT[status]}>{status === "ACTIVE" ? "Active" : "Deactive"}</Badge>;
}
