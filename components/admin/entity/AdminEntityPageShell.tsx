import type { ReactNode } from "react";

/**
 * Consistent max-width and vertical rhythm for admin entity pages (research, ingest, pending, published).
 */
export default function AdminEntityPageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-[1200px] space-y-3 ${className}`.trim()}>{children}</div>;
}
