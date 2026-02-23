import * as React from "react";

type Variant = "primary" | "neutral";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const baseClasses = "rounded-full px-2 py-1 text-xs font-semibold";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-neutral-100 text-neutral-600",
};

export default function Badge({ className = "", variant = "primary", ...props }: Props) {
  return <span className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()} {...props} />;
}
