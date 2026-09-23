import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardAccent = "neutral" | "success" | "danger" | "warning" | "accent";

const ACCENT_STYLES: Record<StatCardAccent, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-success-50 text-success-700",
  danger: "bg-danger-50 text-danger-700",
  warning: "bg-warning-50 text-warning-700",
  accent: "bg-accent-50 text-accent-700",
};

export interface StatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon: LucideIcon;
  accent?: StatCardAccent;
}

export function StatCard({ label, value, icon: Icon, accent = "neutral" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            ACCENT_STYLES[accent]
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
