"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthorizedAdmin, clearSession } from "@/lib/auth/guard";
import { recordAuditEvent, auditMetadataFromHeaders } from "@/lib/audit";

/** Clears the admin session cookie, records an audit event, and redirects to login. */
export async function logoutAction(): Promise<void> {
  const admin = await getAuthorizedAdmin();
  const requestMeta = auditMetadataFromHeaders(headers());

  if (admin) {
    await recordAuditEvent({
      adminId: admin.id,
      action: "ADMIN_LOGOUT",
      entityType: "AdminAccount",
      entityId: admin.id,
      ...requestMeta,
    });
  }

  clearSession();
  redirect("/admin/login");
}
