import { NextResponse } from "next/server";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import type { RegistrationRequestStatus } from "@prisma/client";

const VALID_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED", "AUTO_APPROVED"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status") ?? "ALL";
  const pageParam = Math.max(1, Number(params.get("page")) || 1);
  const pageSizeParam = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));
  const query = params.get("q")?.trim() ?? undefined;

  const statusFilter: StatusFilter = VALID_STATUSES.includes(statusParam as StatusFilter)
    ? (statusParam as StatusFilter)
    : "ALL";

  const where: { status?: RegistrationRequestStatus; deviceId?: { contains: string; mode: "insensitive" } } = {};
  if (statusFilter !== "ALL") {
    where.status = statusFilter as RegistrationRequestStatus;
  }
  if (query) {
    where.deviceId = { contains: query, mode: "insensitive" };
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.deviceRegistrationRequest.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (pageParam - 1) * pageSizeParam,
        take: pageSizeParam,
        include: {
          reviewedByAdmin: { select: { username: true } },
        },
      }),
      prisma.deviceRegistrationRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        status: r.status,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        reviewReason: r.reviewReason ?? null,
        reviewedByUsername: r.reviewedByAdmin?.username ?? null,
      })),
      total,
      page: pageParam,
      pageSize: pageSizeParam,
    });
  } catch (err) {
    console.error("Failed to list registration history:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
