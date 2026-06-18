"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrganizerRow = {
  organizer_id: string;
  role: "owner" | "co_host";
  organizers: {
    id: string;
    name: string;
    logo_url: string | null;
    slug: string;
  };
};

type Props = {
  festivalId: string;
  initial: OrganizerRow[];
};

type SearchHit = { id: string; name: string };

export function CoOrganizersSection({ festivalId, initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<OrganizerRow[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/organizer/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { organizers?: SearchHit[] };
      if (res.ok && Array.isArray(json.organizers)) {
        const linked = new Set(rows.map((r) => r.organizer_id));
        setResults(json.organizers.filter((r) => !linked.has(r.id)));
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
  }

  async function addCoHost(organizerId: string, displayName: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/organizer/festivals/${festivalId}/co-organizers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizer_id: organizerId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при добавяне");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        organizer_id: organizerId,
        role: "co_host",
        organizers: { id: organizerId, name: displayName, logo_url: null, slug: "" },
      },
    ]);
    setQuery("");
    setResults([]);
    router.refresh();
  }

  async function removeCoHost(organizerId: string) {
    if (!confirm("Сигурни ли сте, че искате да премахнете този съ-организатор?")) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/organizer/festivals/${festivalId}/co-organizers?organizer_id=${encodeURIComponent(organizerId)}`,
      { method: "DELETE" },
    );
    const json = await res.json();
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Грешка при премахване");
      return;
    }
    setRows((prev) => prev.filter((r) => r.organizer_id !== organizerId));
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-black/75">Съ-организатори</h2>
      </header>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.organizer_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {row.organizers.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.organizers.logo_url}
                  alt=""
                  className="h-7 w-7 rounded object-cover"
                />
              ) : (
                <div className="h-7 w-7 rounded bg-black/[0.06]" />
              )}
              <span className="text-sm">{row.organizers.name}</span>
              {row.role === "owner" ? (
                <span className="text-xs text-emerald-700">(Собственик)</span>
              ) : null}
            </div>
            {row.role === "co_host" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => removeCoHost(row.organizer_id)}
                className="text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                Премахни
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-black/5 pt-4">
        <label className="block text-xs text-black/55">Добави съ-организатор</label>
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Търси организатор по име..."
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm"
        />
        {results.length > 0 ? (
          <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-black/10 bg-white shadow-sm">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addCoHost(r.id, r.name)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        <p className="mt-3 text-[11px] text-black/45">
          Прехвърли собствеността — скоро.
        </p>
      </div>
    </section>
  );
}
