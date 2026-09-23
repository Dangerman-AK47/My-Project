import { prisma } from "@/lib/db";

export interface RequestStatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

/** Counts registration requests by status — used by the dashboard overview. */
export async function getRequestStatusCounts(): Promise<RequestStatusCounts> {
  const grouped = await prisma.deviceRegistrationRequest.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let cancelled = 0;

  for (const row of grouped) {
    if (row.status === "PENDING") {
      pending += row._count.status;
    } else if (row.status === "APPROVED" || row.status === "AUTO_APPROVED") {
      approved += row._count.status;
    } else if (row.status === "REJECTED") {
      rejected += row._count.status;
    } else if (row.status === "CANCELLED") {
      cancelled += row._count.status;
    }
  }

  return { pending, approved, rejected, cancelled };
}

/** Most recently submitted registration requests, for the dashboard's "recent requests" card. */
export function listRecentRequests(limit = 5) {
  return prisma.deviceRegistrationRequest.findMany({
    orderBy: { submittedAt: "desc" },
    take: limit,
  });
}
