import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  href?: string;
};

const variants: Record<Variant, string> = {
  default: "border apple-border bg-[var(--surface)] text-[color:var(--text)] hover:bg-[var(--surface2)]",
  primary: "bg-[var(--text)] text-white hover:opacity-90",
  ghost: "text-[color:var(--text)] hover:bg-[var(--surface2)]",
};

export default function AppleButton({ variant = "default", href, className, children, ...props }: Props) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
    variants[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
