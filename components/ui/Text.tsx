import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextVariant = "default" | "muted";
type TextSize = "sm" | "md";

const sizeClasses: Record<TextSize, string> = {
  sm: "text-sm",
  md: "text-base",
};

const variantClasses: Record<TextVariant, string> = {
  default: "text-ink",
  muted: "text-muted",
};

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  variant?: TextVariant;
  size?: TextSize;
};

export default function Text({ variant = "default", size = "md", className, ...props }: TextProps) {
  return <p className={cn("leading-7", sizeClasses[size], variantClasses[variant], className)} {...props} />;
}
