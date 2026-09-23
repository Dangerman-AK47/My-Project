import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  const action = searchParams.get("action")?.trim();

  const where: { adminId: { not: null }; action?: string } = {
    adminId: { not: null },
  };

  if (action) {
    where.action = action;
  }

  try {
    const [events, total] = await Promise.all([
      prisma.adminAuditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: { select: { username: true } },
        },
      }),
      prisma.adminAuditEvent.count({ where }),
    ]);

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: e.metadata,
        adminUsername: e.admin?.username ?? "Unknown",
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Failed to load audit events:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
