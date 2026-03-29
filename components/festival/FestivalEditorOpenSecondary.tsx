"use client";

import Link from "next/link";
import type { EditorOpenActionResolved } from "@/lib/festival/editorOpenAction";

const BTN =
  "inline-flex items-center justify-center rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] hover:bg-black/[0.03]";

export default function FestivalEditorOpenSecondary({
  action,
  dimmed,
}: {
  action: EditorOpenActionResolved;
  dimmed?: boolean;
}) {
  const wrap = dimmed ? "pointer-events-none opacity-45" : "";

  if (action.kind === "none") {
    return (
      <button
        type="button"
        disabled
        title="Няма slug, публична страница или външен източник за отваряне."
        className={`${BTN} cursor-not-allowed opacity-40`}
      >
        Няма линк
      </button>
    );
  }

  const label =
    action.variant === "public" ? "Отвори фестивала" : action.variant === "preview" ? "Преглед" : "Източник";

  if (action.kind === "external") {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN} ${wrap}`}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={action.href} target="_blank" rel="noopener noreferrer" className={`${BTN} ${wrap}`}>
      {label}
    </Link>
  );
}
