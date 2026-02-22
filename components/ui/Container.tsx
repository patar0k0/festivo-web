import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type ContainerProps = ComponentPropsWithoutRef<"div">;

export default function Container({ className, ...props }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />
  );
}
