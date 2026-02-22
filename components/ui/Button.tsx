import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white shadow-soft hover:bg-ink/90",
  secondary: "border border-ink/10 bg-white text-ink hover:border-ink/30",
  ghost: "text-ink hover:bg-ink/5",
};

type ButtonProps = {
  variant?: ButtonVariant;
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ variant = "primary", href, className, children, ...props }: ButtonProps) {
  const baseClass = cn(
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2",
    variantClasses[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClass} {...props}>
      {children}
    </button>
  );
}
