import type { ReactNode } from "react";
import AdminFieldLabel from "./AdminFieldLabel";

const INLINE_ROW_CLASS =
  "grid grid-cols-1 gap-1.5 sm:grid sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-x-3";

/**
 * Label + control on one row from `sm` up; stacked (label above) below that.
 * Fixed 120px label column matches across sections when combined with `AdminFieldLabel` `inline` variant.
 */
export default function AdminFieldInlineRow({
  field,
  children,
  className = "",
}: {
  field: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${INLINE_ROW_CLASS} ${className}`.trim()}>
      <AdminFieldLabel field={field} variant="inline" />
      <div className="min-w-0">{children}</div>
    </label>
  );
}
