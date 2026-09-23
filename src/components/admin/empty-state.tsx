import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
}

export function EmptyState({ message, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-slate-300" aria-hidden="true" />}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
