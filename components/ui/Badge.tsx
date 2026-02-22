import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "free" | "category";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-ink/10 bg-white text-ink",
  free: "border-emerald-200 bg-emerald-50 text-emerald-700",
  category: "border-ink/10 bg-sand text-ink",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export default function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
