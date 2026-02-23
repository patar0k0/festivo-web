import type { InputHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-ink",
        "placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20",
        className
      )}
      {...props}
    />
  );
}
