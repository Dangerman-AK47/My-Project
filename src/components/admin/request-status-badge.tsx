import { Badge } from "@/components/ui/badge";

export type RequestStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "AUTO_APPROVED";

const VARIANT: Record<RequestStatusValue, "warning" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  AUTO_APPROVED: "success",
};

const LABEL: Record<RequestStatusValue, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  AUTO_APPROVED: "Auto-Approved",
};

export function RequestStatusBadge({ status }: { status: RequestStatusValue }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
