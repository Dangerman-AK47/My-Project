import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  FileStack,
  FileText,
  History,
  LayoutDashboard,
  Settings2,
  UploadCloud,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sensors", label: "Sensors", icon: Activity },
  { href: "/admin/configs", label: "Configuration Settings", icon: Settings2 },
  { href: "/admin/history", label: "Registration History", icon: History },
  { href: "/admin/files", label: "Uploaded Files", icon: FileStack },
  { href: "/admin/version-check-metrics", label: "Version Check Metrics", icon: BarChart3 },
  { href: "/admin/audit", label: "Audit Logs", icon: FileText },
  { href: "/upload", label: "Upload Data", icon: UploadCloud },
];

/** Whether a nav item should render as "active" for the current pathname. */
export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.href === "/upload") return false; // external to the admin section
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Looks up the header's page title from the current pathname via the same nav list. */
export function getPageTitle(pathname: string): string {
  const match = ADMIN_NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
  return match?.label ?? "Sensor Platform Admin";
}
