import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SectionProps = ComponentPropsWithoutRef<"section">;

export default function Section({ className, ...props }: SectionProps) {
  return <section className={cn("py-10 sm:py-14", className)} {...props} />;
}
