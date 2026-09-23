"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { ADMIN_NAV_ITEMS, isNavItemActive } from "./nav-config";

export interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarContents({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-navy-800 text-white"
                  : "text-slate-300 hover:bg-navy-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="px-3 pb-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-navy-800 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          Logout
        </button>
      </form>
    </>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: fixed, always visible at lg+ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 lg:flex">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-white">FileVault Admin</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Secure admin session
          </p>
        </div>
        <SidebarContents pathname={pathname} />
      </aside>

      {/* Mobile: overlay drawer, only rendered while open */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 shadow-lg"
          >
            <div className="flex items-start justify-between px-4 py-5">
              <div>
                <p className="text-sm font-semibold text-white">FileVault Admin</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Secure admin session
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContents pathname={pathname} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
