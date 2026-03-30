import type { ReactNode } from "react";

/**
 * Two-column field grid on desktop; children should use `md:col-span-2` for full-width rows.
 */
export default function AdminFieldGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-x-3 gap-y-2 md:grid-cols-2 ${className}`.trim()}>{children}</div>;
}
