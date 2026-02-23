import type { SelectHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-ink",
        "focus:outline-none focus:ring-2 focus:ring-orange-500/20",
        className
      )}
      {...props}
    />
  );
}
