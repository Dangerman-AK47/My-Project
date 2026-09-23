import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-accent-100 bg-accent-50 text-accent-700",
      success: "border-success-50 bg-success-50 text-success-700",
      danger: "border-danger-50 bg-danger-50 text-danger-700",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  danger: AlertCircle,
};

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = icons[variant ?? "info"];
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-sm opacity-90">{children}</div>}
      </div>
    </div>
  );
}
