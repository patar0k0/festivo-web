import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type HeadingSize = "h1" | "h2" | "h3";

const sizeClasses: Record<HeadingSize, string> = {
  h1: "text-3xl sm:text-4xl",
  h2: "text-2xl sm:text-3xl",
  h3: "text-xl sm:text-2xl",
};

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: HeadingSize;
  size?: HeadingSize;
};

export default function Heading({ as = "h2", size, className, ...props }: HeadingProps) {
  const Component = as;
  const resolvedSize = size ?? as;
  return (
    <Component
      className={cn("font-semibold tracking-tight text-ink", sizeClasses[resolvedSize], className)}
      {...props}
    />
  );
}
