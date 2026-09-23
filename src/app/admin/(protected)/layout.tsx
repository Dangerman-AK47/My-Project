import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth/guard";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Wraps every page under /admin/(protected)/* — dashboard, users, requests,
 * files. `requireAdminSession()` redirects to /admin/login before any of
 * those pages render, so this one call is the auth guard for all of them.
 * /admin/login lives outside this route group and is unaffected.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminSession();

  return <AdminShell admin={{ username: admin.username, role: admin.role }}>{children}</AdminShell>;
}
