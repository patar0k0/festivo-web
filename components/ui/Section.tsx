import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/components/ui/cn";

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  background?: "white" | "muted";
};

export default function Section({ className, background = "white", ...props }: SectionProps) {
  return (
    <section
      className={cn("py-14 sm:py-16", background === "muted" ? "bg-neutral-50" : "bg-white", className)}
      {...props}
    />
  );
}
