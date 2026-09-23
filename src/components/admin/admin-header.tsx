"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { logoutAction } from "@/lib/auth/actions";
import { getPageTitle } from "./nav-config";

export interface AdminHeaderProps {
  admin: { username: string; role: string };
  onMenuClick: () => void;
}

export function AdminHeader({ admin, onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const { showToast } = useToast();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="text-slate-500 hover:text-slate-700 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            showToast({ variant: "info", message: "You're all caught up \u2014 no new notifications." })
          }
          aria-label="Notifications"
          className="text-slate-400 hover:text-slate-600"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm text-slate-700">{admin.username}</span>
          <Badge variant="accent">{admin.role}</Badge>
        </div>

        <form action={logoutAction} className="hidden sm:block">
          <Button type="submit" variant="secondary" size="sm">
            Logout
          </Button>
        </form>
      </div>
    </header>
  );
}
