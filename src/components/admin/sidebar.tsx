"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { ADMIN_NAV_ITEMS, isNavItemActive } from "./nav-config";

export interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarContents({
  pathname,
  pendingHref,
  onSelectHref,
  onNavigate,
}: {
  pathname: string;
  pendingHref: string | null;
  onSelectHref: (href: string) => void;
  onNavigate?: () => void;
}) {
  const effectivePathname = pendingHref ?? pathname;

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, effectivePathname);
          const isPending = pendingHref === item.href && pathname !== item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href.startsWith("/admin/")}
              onClick={(e) => {
                if (
                  !e.metaKey &&
                  !e.ctrlKey &&
                  !e.shiftKey &&
                  !e.altKey &&
                  e.button === 0 &&
                  item.href !== pathname
                ) {
                  onSelectHref(item.href);
                }
                onNavigate?.();
              }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
                active
                  ? "bg-navy-800 text-white"
                  : "text-slate-300 hover:bg-navy-800 hover:text-white"
              )}
            >
              <span className="flex items-center gap-3 truncate">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {isPending && (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-300 motion-reduce:animate-none"
                  aria-label="Loading section"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="px-3 pb-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors duration-150 hover:bg-navy-800 hover:text-white motion-reduce:transition-none"
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
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
        <SidebarContents
          pathname={pathname}
          pendingHref={pendingHref}
          onSelectHref={setPendingHref}
        />
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
            <SidebarContents
              pathname={pathname}
              pendingHref={pendingHref}
              onSelectHref={setPendingHref}
              onNavigate={onClose}
            />
          </aside>
        </div>
      )}
    </>
  );
}
