"use client";

import { useState } from "react";
import { listEvidenceSources } from "@/lib/admin/pendingEvidenceSources";

export default function PendingFestivalEvidenceSources({
  evidenceJson,
  sourceCount,
  defaultOpen = false,
}: {
  evidenceJson: unknown;
  sourceCount: number | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const evidenceSources = listEvidenceSources(evidenceJson);
  const sourceTotal =
    sourceCount != null && Number.isFinite(Number(sourceCount)) ? Number(sourceCount) : 0;
  const showing = evidenceSources.length;

  return (
    <div className="flex flex-col gap-1.5 text-xs text-black/65">
      <span className="text-black/70">
        Sources: {sourceTotal} (showing {showing})
      </span>
      {evidenceSources.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-fit rounded-md border border-black/15 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/70 hover:bg-black/[0.03]"
          >
            {open ? "Hide sources" : "Show sources"}
          </button>
          {open ? (
            <ul className="mt-0.5 list-none space-y-1 break-all text-[11px] leading-snug text-black/60">
              {evidenceSources.map((s, idx) => (
                <li key={`src-${idx}`}>
                  <span className="font-medium text-black/55">{s.type}</span>
                  <span className="text-black/40"> → </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-black/20 underline-offset-2"
                  >
                    {s.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <span className="text-[11px] text-black/45">No evidence sources</span>
      )}
    </div>
  );
}
