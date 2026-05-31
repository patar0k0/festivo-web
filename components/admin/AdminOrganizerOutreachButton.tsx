"use client";

import { useState } from "react";
import OrganizerOutreachModal from "@/components/admin/OrganizerOutreachModal";

type Festival = { id: string; title: string; slug: string | null };

type Props = {
  organizerId: string;
  organizerName: string;
  organizerEmail: string | null;
  festivals: Festival[];
};

export default function AdminOrganizerOutreachButton({
  organizerId,
  organizerName,
  organizerEmail,
  festivals,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#7c2d12]/40 px-3 py-1.5 text-xs font-semibold text-[#7c2d12] hover:bg-[#7c2d12]/5 transition-colors"
        title="Изпрати покана до организатора"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        Покани
      </button>

      {open && (
        <OrganizerOutreachModal
          organizerId={organizerId}
          organizerName={organizerName}
          organizerEmail={organizerEmail}
          festivals={festivals}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
