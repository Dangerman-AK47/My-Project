import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface RecordAuditEventInput {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Records one AdminAuditEvent row. Accepts an optional transaction client
 * so callers that need the audit row to commit atomically with the change
 * it describes (e.g. approving a request) can pass `tx` from
 * `prisma.$transaction(async (tx) => ...)`; otherwise it writes directly.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
  client: PrismaClient | Prisma.TransactionClient = prisma
): Promise<void> {
  await client.adminAuditEvent.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/** Best-effort request metadata (IP/user agent) for audit rows, from Next.js headers. */
export function auditMetadataFromHeaders(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwardedFor = headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor ? forwardedFor.split(",")[0]!.trim() : null,
    userAgent: headers.get("user-agent"),
  };
}
