import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type BadgeVariant = "neutral" | "primary";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  primary: "bg-orange-50 text-orange-500",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export default function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
