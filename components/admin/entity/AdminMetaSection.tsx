import type { ReactNode } from "react";
import AdminFieldSection from "./AdminFieldSection";
import { ADMIN_SECTION } from "./adminSectionTitles";

/**
 * System / moderation / ingestion metadata block (typically placed last).
 */
export default function AdminMetaSection({
  title = ADMIN_SECTION.systemMeta,
  description,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminFieldSection title={title} description={description} variant="system">
      {children}
    </AdminFieldSection>
  );
}

/** Collapsible technical details (JSON, debug keys). */
export function AdminMetaDetails({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-xl border border-black/[0.08] bg-white/80 p-2.5" open={defaultOpen}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{summary}</summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  );
}
