import type { ReactNode } from "react";

/**
 * Two-column field grid on desktop; children should use `md:col-span-2` for full-width rows.
 * `items-start` keeps left/right pairs top-aligned when row heights differ; fields still use their own inline row alignment.
 */
export default function AdminFieldGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-x-3 gap-y-2 md:grid-cols-2 md:items-start ${className}`.trim()}>{children}</div>;
}
