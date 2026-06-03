"use client";

import { useState } from "react";

type OrganizerCard = {
  id: string;
  name: string | null;
  slug: string | null;
  facebook_url: string | null;
  website_url: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  festivalCount?: number;
};

type DuplicateRow = {
  left: OrganizerCard;
  right: OrganizerCard;
  reasons: string[];
  confidence: "high" | "medium";
};

type DismissedRow = {
  left: OrganizerCard;
  right: OrganizerCard;
};

type ConfirmingState = {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceFestivals: number;
};

function OrganizerCardView({ org }: { org: OrganizerCard }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {org.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logo_url}
            alt=""
            className="h-8 w-8 flex-shrink-0 rounded-lg object-cover"
          />
        )}
        <a
          href={`/admin/organizers/${org.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#0c0e14] hover:underline"
        >
          {org.name ?? "(без име)"}
        </a>
      </div>
      <div className="space-y-0.5 text-xs text-black/55">
        <div>{org.festivalCount ?? 0} фестивала</div>
        {org.slug && <div>slug: {org.slug}</div>}
        {org.website_url && <div>web: {org.website_url}</div>}
        {org.email && <div>имейл: {org.email}</div>}
        {org.phone && <div>тел: {org.phone}</div>}
        {org.facebook_url && <div>fb: {org.facebook_url}</div>}
        {org.description && (
          <div className="mt-1 line-clamp-2 text-black/40">{org.description}</div>
        )}
      </div>
    </div>
  );
}

export default function OrganizerDuplicatesTable({
  rows,
  dismissedRows,
}: {
  rows: DuplicateRow[];
  dismissedRows: DismissedRow[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ConfirmingState | null>(null);
  const [dismissedOpen, setDismissedOpen] = useState(false);

  async function merge(sourceId: string, targetId: string) {
    const key = `merge:${sourceId}:${targetId}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Грешка при сливане.");
      setMessage("Сливането е успешно. Презареждане…");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
      setConfirming(null);
    }
  }

  async function dismiss(a: string, b: string) {
    const key = `dismiss:${[a, b].sort().join(":")}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/duplicates/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Грешка при отхвърляне.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
    }
  }

  async function restore(a: string, b: string) {
    const key = `restore:${[a, b].sort().join(":")}`;
    setLoadingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/organizers/duplicates/dismiss", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !payload?.ok)
        throw new Error(payload?.error ?? "Грешка при възстановяване.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неочаквана грешка.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-5">
      <p className="text-sm text-black/65">
        Консервативни съвпадения. Всяко сливане е ръчно и необратимо.
      </p>

      {message && <p className="text-sm text-[#1f7a37]">{message}</p>}
      {error && <p className="text-sm text-[#b13a1a]">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/65">
          Не са намерени вероятни дубликати.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.08]">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
              <tr>
                <th className="px-3 py-2">Ляв организатор</th>
                <th className="px-3 py-2">Десен организатор</th>
                <th className="px-3 py-2">Съвпадения</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pairId = [row.left.id, row.right.id].sort().join(":");
                const isConfirming =
                  confirming !== null &&
                  [confirming.sourceId, confirming.targetId].sort().join(":") === pairId;

                return (
                  <tr key={pairId} className="border-t border-black/[0.08] align-top">
                    <td className="px-3 py-3">
                      <OrganizerCardView org={row.left} />
                    </td>
                    <td className="px-3 py-3">
                      <OrganizerCardView org={row.right} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.confidence === "high"
                              ? "bg-[#0c0e14] text-white"
                              : "bg-black/[0.08] text-black/60"
                          }`}
                        >
                          {row.confidence === "high" ? "висока" : "средна"}
                        </span>
                        {row.reasons.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-black/60"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {isConfirming ? (
                        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs text-amber-900">
                            <strong>{confirming.sourceName}</strong> ще се слее в{" "}
                            <strong>{confirming.targetName}</strong>.
                            {confirming.sourceFestivals > 0 &&
                              ` ${confirming.sourceFestivals} фестивала се местят.`}{" "}
                            Действието е необратимо.
                          </p>
                          <div className="flex gap-2">
                            <button
                              disabled={loadingKey !== null}
                              onClick={() => merge(confirming.sourceId, confirming.targetId)}
                              className="rounded-lg bg-[#b13a1a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {loadingKey !== null ? "Сливане…" : "Потвърди"}
                            </button>
                            <button
                              disabled={loadingKey !== null}
                              onClick={() => setConfirming(null)}
                              className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                            >
                              Откажи
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <button
                            disabled={loadingKey !== null}
                            onClick={() =>
                              setConfirming({
                                sourceId: row.left.id,
                                targetId: row.right.id,
                                sourceName: row.left.name ?? "(без име)",
                                targetName: row.right.name ?? "(без име)",
                                sourceFestivals: row.left.festivalCount ?? 0,
                              })
                            }
                            className="block w-full rounded-lg bg-[#0c0e14] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            Слей ляв → десен
                          </button>
                          <button
                            disabled={loadingKey !== null}
                            onClick={() =>
                              setConfirming({
                                sourceId: row.right.id,
                                targetId: row.left.id,
                                sourceName: row.right.name ?? "(без име)",
                                targetName: row.left.name ?? "(без име)",
                                sourceFestivals: row.right.festivalCount ?? 0,
                              })
                            }
                            className="block w-full rounded-lg border border-black/[0.15] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                          >
                            Слей десен → ляв
                          </button>
                          <button
                            disabled={loadingKey !== null}
                            onClick={() => dismiss(row.left.id, row.right.id)}
                            className="block w-full rounded-lg border border-black/[0.10] px-3 py-2 text-xs font-medium text-black/50 hover:bg-black/[0.03] disabled:opacity-50"
                          >
                            Не са дубликати
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dismissedRows.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setDismissedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-black/45 hover:text-black/65"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${dismissedOpen ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            Отхвърлени двойки ({dismissedRows.length})
          </button>
          {dismissedOpen && (
            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              <table className="min-w-full text-xs">
                <tbody>
                  {dismissedRows.map((row) => {
                    const pairId = [row.left.id, row.right.id].sort().join(":");
                    const restoreKey = `restore:${pairId}`;
                    return (
                      <tr
                        key={pairId}
                        className="border-t border-black/[0.06] first:border-t-0"
                      >
                        <td className="px-3 py-2 text-black/50">
                          {row.left.name ?? "(без име)"}
                        </td>
                        <td className="px-3 py-2 text-black/35">↔</td>
                        <td className="px-3 py-2 text-black/50">
                          {row.right.name ?? "(без име)"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            disabled={loadingKey !== null}
                            onClick={() => restore(row.left.id, row.right.id)}
                            className="rounded-lg border border-black/[0.12] px-2 py-1 text-[11px] font-medium text-black/50 hover:bg-black/[0.03] disabled:opacity-50"
                          >
                            {loadingKey === restoreKey ? "…" : "Върни"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
