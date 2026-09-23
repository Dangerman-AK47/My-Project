import { prisma } from "@/lib/db";

export interface RequestStatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

/** Counts registration requests by status — used by the dashboard overview. */
export async function getRequestStatusCounts(): Promise<RequestStatusCounts> {
  const [pending, approved, rejected, cancelled] = await Promise.all([
    prisma.deviceRegistrationRequest.count({ where: { status: "PENDING" } }),
    prisma.deviceRegistrationRequest.count({ where: { status: "APPROVED" } }),
    prisma.deviceRegistrationRequest.count({ where: { status: "REJECTED" } }),
    prisma.deviceRegistrationRequest.count({ where: { status: "CANCELLED" } }),
  ]);
  return { pending, approved, rejected, cancelled };
}

/** Most recently submitted registration requests, for the dashboard's "recent requests" card. */
export function listRecentRequests(limit = 5) {
  return prisma.deviceRegistrationRequest.findMany({
    orderBy: { submittedAt: "desc" },
    take: limit,
  });
}
