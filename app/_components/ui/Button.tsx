import * as React from "react";

type Variant = "primary" | "secondary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const baseClasses = "inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary: "bg-white border border-black/10 hover:bg-neutral-50",
  ghost: "bg-transparent hover:bg-black/5",
};

export default function Button({ className = "", variant = "primary", ...props }: Props) {
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()} {...props} />;
}
