import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/components/ui/cn";

type CardProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md",
        className
      )}
      {...props}
    />
  );
}

type CardSectionProps = ComponentPropsWithoutRef<"div">;

export function CardHeader({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-8", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return <h3 className={cn("text-lg font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm text-neutral-600", className)} {...props} />;
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardSectionProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
