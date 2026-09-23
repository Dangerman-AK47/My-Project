import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AuditPageClient, type AuditEventItem } from "@/components/admin/audit-page-client";

export const metadata: Metadata = {
  title: "Audit Logs — Sensor Platform Admin",
};

const PAGE_SIZE = 20;

export default async function AuditLogsPage() {
  const where = { adminId: { not: null } };

  const [rows, total] = await Promise.all([
    prisma.adminAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        admin: { select: { username: true } },
      },
    }),
    prisma.adminAuditEvent.count({ where }),
  ]);

  const events: AuditEventItem[] = rows.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    metadata: e.metadata,
    adminUsername: e.admin?.username ?? "Unknown",
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <AuditPageClient
      initialEvents={events}
      initialTotal={total}
      initialPage={1}
      pageSize={PAGE_SIZE}
    />
  );
}
