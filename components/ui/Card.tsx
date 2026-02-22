import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type CardProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_20px_50px_-45px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    />
  );
}

type CardSectionProps = ComponentPropsWithoutRef<"div">;

export function CardMedia({ className, ...props }: CardSectionProps) {
  return <div className={cn("relative", className)} {...props} />;
}

export function CardBody({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-5", className)} {...props} />;
}
