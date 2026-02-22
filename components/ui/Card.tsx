import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type CardProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-ink/10 bg-white shadow-soft",
        className
      )}
      {...props}
    />
  );
}

type CardSectionProps = ComponentPropsWithoutRef<"div">;

export function CardHeader({ className, ...props }: CardSectionProps) {
  return <div className={cn("relative", className)} {...props} />;
}

export function CardBody({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-5", className)} {...props} />;
}
