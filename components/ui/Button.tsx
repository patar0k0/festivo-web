import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-95",
  secondary: "border border-neutral-200 bg-white text-ink hover:bg-neutral-50",
  ghost: "bg-transparent text-ink hover:bg-neutral-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  className?: string;
};

type LinkButtonProps = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export default function Button({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  ...props
}: ButtonProps | LinkButtonProps) {
  const baseClass = cn(
    "inline-flex items-center justify-center rounded-xl font-semibold shadow-sm transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  if (href) {
    const { href: _href, ...linkProps } = props as LinkButtonProps;
    return (
      <Link href={href} className={baseClass} {...linkProps}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClass} {...(props as ButtonProps)}>
      {children}
    </button>
  );
}
