import { getAdminFieldLabel } from "@/lib/admin/entitySchema";

/**
 * Standard uppercase label for admin entity fields — uses canonical strings from `entitySchema`.
 */
export default function AdminFieldLabel({
  field,
  className = "",
}: {
  field: string;
  className?: string;
}) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-[0.14em] text-black/50 ${className}`.trim()}>{getAdminFieldLabel(field)}</span>
  );
}
