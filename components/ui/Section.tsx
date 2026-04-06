import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  /** Default transparent so the root `landing-bg` shows through on public pages. */
  background?: "transparent" | "white" | "muted";
};

export default function Section({ className, background = "transparent", ...props }: SectionProps) {
  const bgClass =
    background === "muted" ? "bg-neutral-50" : background === "white" ? "bg-white" : "";
  return (
    <section className={cn("py-14 sm:py-16", bgClass, className)} {...props} />
  );
}
