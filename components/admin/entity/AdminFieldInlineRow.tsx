import type { ReactNode } from "react";
import AdminFieldLabel from "./AdminFieldLabel";

/** Shared with custom rows that need the same label column + control track (e.g. checkbox without wrapping `<label>`). */
export const ADMIN_FIELD_INLINE_ROW_CLASS =
  "grid grid-cols-1 gap-1.5 sm:grid sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-x-3";

/**
 * Label + control on one row from `sm` up; stacked (label above) below that.
 * Fixed ~120px label column (right-aligned from `sm`) matches across sections when combined with `AdminFieldLabel` `inline` variant.
 * Use `as="div"` when the control is not a single focusable under a native `<label>` (e.g. bare checkbox).
 */
export default function AdminFieldInlineRow({
  field,
  children,
  className = "",
  as = "label",
}: {
  field: string;
  children: ReactNode;
  className?: string;
  as?: "label" | "div";
}) {
  const inner = (
    <>
      <AdminFieldLabel field={field} variant="inline" />
      <div className="min-w-0">{children}</div>
    </>
  );
  const rowClass = `${ADMIN_FIELD_INLINE_ROW_CLASS} ${className}`.trim();
  if (as === "div") {
    return <div className={rowClass}>{inner}</div>;
  }
  return <label className={rowClass}>{inner}</label>;
}
