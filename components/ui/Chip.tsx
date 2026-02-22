import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ChipProps = {
  selected?: boolean;
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Chip({ selected, href, className, children, ...props }: ChipProps) {
  const baseClass = cn(
    "inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2",
    selected
      ? "border-ink bg-ink text-white"
      : "border-ink/10 bg-white text-ink hover:border-ink/30",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClass} aria-current={selected ? "page" : undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" aria-pressed={selected} className={baseClass} {...props}>
      {children}
    </button>
  );
}
