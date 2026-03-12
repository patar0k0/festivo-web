"use client";

import { useMemo, useState } from "react";

export type DiscoveredLinkRow = {
  id: string;
  selected: boolean | null;
  sourceId: string;
  createdAt: string | null;
  sourceLabel: string;
  normalizedUrl: string;
  score: number | null;
  decision: string;
  ingestJobId: string;
  rejectReason: string;
  reasonsJsonPretty: string | null;
  sourceText: string;
};

type Props = {
  links: DiscoveredLinkRow[];
};

function normalizeDecision(value: string) {
  return value.trim().toLowerCase();
}

function isSelectedDecision(decision: string) {
  return ["selected", "enqueue", "enqueued", "queued", "accepted"].some((candidate) => decision.includes(candidate));
}

function isRejectedDecision(decision: string) {
  return ["rejected", "reject", "ignored", "skip", "skipped", "duplicate", "filtered"].some((candidate) => decision.includes(candidate));
}

function selectedStateLabel(link: DiscoveredLinkRow, isSelected: boolean, isRejected: boolean) {
  if (link.selected !== null) {
    return link.selected ? "selected_for_enqueue=true" : "selected_for_enqueue=false";
  }

  if (isSelected) return "selected/enqueued (derived)";
  if (isRejected) return "rejected (derived)";
  return "unknown";
}

export default function DiscoveredLinksInspectorTable({ links }: Props) {
  const [activeLinkKey, setActiveLinkKey] = useState<string | null>(null);

  const keyedLinks = useMemo(
    () =>
      links.map((link, index) => {
        const key = link.id || `${link.createdAt ?? "n/a"}-${link.normalizedUrl || "n/a"}-${index}`;
        return { key, link };
      }),
    [links],
  );

  const active = useMemo(() => keyedLinks.find((entry) => entry.key === activeLinkKey)?.link ?? null, [activeLinkKey, keyedLinks]);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <table className="min-w-full divide-y divide-black/[0.08] text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-[0.14em] text-black/50">
            <tr>
              <th className="px-3 py-3">Created</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Normalized URL</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Decision</th>
              <th className="px-3 py-3">Ingest job</th>
              <th className="px-3 py-3">Reject reason</th>
              <th className="px-3 py-3">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {keyedLinks.length ? (
              keyedLinks.map(({ key, link }) => {
                const normalizedDecision = normalizeDecision(link.decision);
                const isSelected = isSelectedDecision(normalizedDecision) || Boolean(link.ingestJobId);
                const isRejected = isRejectedDecision(normalizedDecision);
                const isStrongScore = link.score !== null && link.score >= 0.7;

                const rowClass = isRejected
                  ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                  : isSelected || isStrongScore
                    ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.1]"
                    : "hover:bg-black/[0.02]";

                return (
                  <tr key={key} className={rowClass}>
                    <td className="whitespace-nowrap px-3 py-3 text-black/65">{link.createdAt ? new Date(link.createdAt).toLocaleString("bg-BG") : "-"}</td>
                    <td className="px-3 py-3 text-black/75">{link.sourceLabel}</td>
                    <td className="max-w-[30rem] px-3 py-3 text-black/75">
                      <span className="block truncate font-mono text-xs sm:text-sm" title={link.normalizedUrl || "-"}>
                        {link.normalizedUrl || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-black/65">{link.score ?? "-"}</td>
                    <td className="px-3 py-3 text-black/65">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          isRejected
                            ? "bg-rose-500/15 text-rose-700"
                            : isSelected
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-black/[0.06] text-black/65",
                        ].join(" ")}
                      >
                        {link.decision}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-black/65">{link.ingestJobId || "-"}</td>
                    <td className="px-3 py-3 text-[#b13a1a]">{link.rejectReason || "-"}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setActiveLinkKey(key)}
                        className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-black/65 hover:bg-black/[0.03] hover:text-black"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-black/50" colSpan={8}>
                  No discovered links found for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Discovered link details">
          <button
            type="button"
            onClick={() => setActiveLinkKey(null)}
            className="h-full flex-1 cursor-default"
            aria-label="Close discovered link details"
          />
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-black/10 bg-white p-5 shadow-[-20px_0_40px_rgba(12,14,20,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Discovered Link Inspector</p>
                <h3 className="mt-1 text-lg font-black tracking-tight">Discovery scoring details</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLinkKey(null)}
                className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-black/60 hover:bg-black/[0.03] hover:text-black"
              >
                Close
              </button>
            </div>

            {(() => {
              const normalizedDecision = normalizeDecision(active.decision);
              const isSelected = isSelectedDecision(normalizedDecision) || Boolean(active.ingestJobId);
              const isRejected = isRejectedDecision(normalizedDecision);

              return (
                <div className="mt-5 space-y-4 text-sm text-black/75">
                  <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                    <p className="font-semibold text-black/60">Normalized URL</p>
                    <p className="mt-1 break-all font-mono text-xs text-black/80">{active.normalizedUrl || "-"}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Source label</p>
                      <p className="mt-1 font-semibold text-black/80">{active.sourceLabel || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Source ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-black/80">{active.sourceId || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Score</p>
                      <p className="mt-1 font-semibold text-black/80">{active.score ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Decision</p>
                      <p className="mt-1 font-semibold text-black/80">{active.decision || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Selected state</p>
                      <p className="mt-1 font-semibold text-black/80">{selectedStateLabel(active, isSelected, isRejected)}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Ingest job ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-black/80">{active.ingestJobId || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-3 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">Reject reason</p>
                      <p className="mt-1 text-black/80">{active.rejectReason || "-"}</p>
                    </div>
                  </div>

                  {active.reasonsJsonPretty ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-black/45">reasons_json</p>
                      <pre className="mt-2 max-h-[24rem] overflow-auto rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[11px] leading-relaxed text-black/80">
                        {active.reasonsJsonPretty}
                      </pre>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </>
  );
}
