import { getAdminFieldLabel } from "@/lib/admin/entitySchema";

/**
 * Standard label for admin entity fields — uses canonical strings from `entitySchema`.
 * `stacked`: uppercase strip above the control; `inline`: small muted label for row layouts.
 */
export default function AdminFieldLabel({
  field,
  variant = "stacked",
  className = "",
}: {
  field: string;
  variant?: "stacked" | "inline";
  className?: string;
}) {
  const base =
    variant === "inline"
      ? "block text-left text-xs font-medium leading-snug text-black/45 max-sm:mb-0 sm:text-right sm:pt-0.5"
      : "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50";
  return <span className={`${base} ${className}`.trim()}>{getAdminFieldLabel(field)}</span>;
}
