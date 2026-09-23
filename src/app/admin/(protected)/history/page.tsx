import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { RequestsPageClient } from "@/components/admin/requests-page-client";

export const metadata: Metadata = {
  title: "Registration History — Sensor Platform Admin",
};

const PAGE_SIZE = 20;

export default async function RegistrationHistoryPage() {
  const [rows, total] = await Promise.all([
    prisma.deviceRegistrationRequest.findMany({
      orderBy: { submittedAt: "desc" },
      take: PAGE_SIZE,
      include: { reviewedByAdmin: { select: { username: true } } },
    }),
    prisma.deviceRegistrationRequest.count(),
  ]);

  const requests = rows.map((r) => ({
    id: r.id,
    deviceId: r.deviceId,
    status: r.status,
    submittedAt: r.submittedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewReason: r.reviewReason ?? null,
    reviewedByUsername: r.reviewedByAdmin?.username ?? null,
  }));

  return (
    <RequestsPageClient
      initialRequests={requests}
      initialTotal={total}
      initialPage={1}
      pageSize={PAGE_SIZE}
    />
  );
}
