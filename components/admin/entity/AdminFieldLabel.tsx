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
    <span className={`mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50 ${className}`.trim()}>{getAdminFieldLabel(field)}</span>
  );
}
