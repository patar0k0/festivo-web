import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type StackSize = "sm" | "md" | "lg" | "xl";

const gapClasses: Record<StackSize, string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
  xl: "gap-12",
};

type StackProps = ComponentPropsWithoutRef<"div"> & {
  size?: StackSize;
};

export default function Stack({ className, size = "md", ...props }: StackProps) {
  return <div className={cn("flex flex-col", gapClasses[size], className)} {...props} />;
}
