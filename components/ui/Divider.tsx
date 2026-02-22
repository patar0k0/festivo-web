import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type DividerProps = ComponentPropsWithoutRef<"hr">;

export default function Divider({ className, ...props }: DividerProps) {
  return <hr className={cn("border-ink/10", className)} {...props} />;
}
