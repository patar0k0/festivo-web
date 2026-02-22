import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  href?: string;
  children: React.ReactNode;
  className?: string;
};

export default function ApplePill({ active, href, children, className }: Props) {
  const classes = cn(
    "inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition",
    active
      ? "border-transparent bg-[var(--text)] text-white"
      : "apple-border bg-[var(--surface)] text-[color:var(--text)] hover:bg-[var(--surface2)]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    );
  }

  return <span className={classes}>{children}</span>;
}
