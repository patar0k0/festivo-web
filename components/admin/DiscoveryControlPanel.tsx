"use client";

import { useCallback, useEffect, useState } from "react";

type DiscoveryConfig = {
  score_threshold: number;
  max_sources_per_run: number;
  max_links_per_source: number;
  max_jobs_per_run: number;
  fetch_timeout_ms: number;
  soft_disable_approval_floor: number;
  soft_disable_min_enqueued: number;
  recovery_every: number;
  cron_enabled: boolean;
};

type RunRequest = {
  id: string;
  status: string;
  mode: string;
  source_id: number | null;
  requested_at: string;
  finished_at: string | null;
  run_id: number | null;
  error: string | null;
};

const NUMERIC_FIELDS: Array<{ key: keyof DiscoveryConfig; label: string; step?: number }> = [
  { key: "score_threshold", label: "Score праг" },
  { key: "max_sources_per_run", label: "Max източници / run" },
  { key: "max_links_per_source", label: "Max линкове / източник" },
  { key: "max_jobs_per_run", label: "Max jobs / run" },
  { key: "fetch_timeout_ms", label: "Fetch timeout (ms)" },
  { key: "soft_disable_approval_floor", label: "Soft-disable approval floor", step: 0.01 },
  { key: "soft_disable_min_enqueued", label: "Soft-disable min enqueued" },
  { key: "recovery_every", label: "Recovery на всеки N runs" },
];

export default function DiscoveryControlPanel() {
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [requests, setRequests] = useState<RunRequest[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await fetch("/admin/api/discovery/config");
    const json = await res.json();
    if (json.ok) setConfig(json.config);
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/admin/api/discovery/requests");
    const json = await res.json();
    if (json.ok) setRequests(json.requests);
  }, []);

  useEffect(() => {
    loadConfig();
    loadRequests();
  }, [loadConfig, loadRequests]);

  // Poll while a request is active.
  useEffect(() => {
    const hasActive = requests.some((r) => r.status === "requested" || r.status === "claimed");
    if (!hasActive) return;
    const t = setInterval(loadRequests, 5000);
    return () => clearInterval(t);
  }, [requests, loadRequests]);

  const triggerRun = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" }),
      });
      const json = await res.json();
      setNotice(
        json.ok
          ? json.deduped
            ? "Вече има чакаща заявка."
            : "Заявката е създадена."
          : `Грешка: ${json.error}`
      );
      await loadRequests();
    } finally {
      setBusy(false);
    }
  }, [loadRequests]);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/discovery/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      setNotice(json.ok ? "Config-ът е запазен." : `Грешка: ${json.error}`);
      if (json.ok) setConfig(json.config);
    } finally {
      setBusy(false);
    }
  }, [config]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={triggerRun}
          disabled={busy}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"
        >
          Пусни discovery
        </button>
        {notice && <span className="text-sm text-black/60">{notice}</span>}
      </div>

      {config && (
        <div className="rounded-2xl border border-black/10 p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-black/50">Config</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {NUMERIC_FIELDS.map(({ key, label, step }) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-black/60">{label}</span>
                <input
                  type="number"
                  step={step ?? 1}
                  value={config[key] as number}
                  onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                  className="rounded-lg border border-black/15 px-2 py-1"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.cron_enabled}
                onChange={(e) => setConfig({ ...config, cron_enabled: e.target.checked })}
              />
              <span className="text-black/60">Cron активен</span>
            </label>
          </div>
          <button
            onClick={saveConfig}
            disabled={busy}
            className="mt-4 rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-45"
          >
            Запази config
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-black/10 p-5">
        <h3 className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-black/50">Заявки</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50">
              <th className="py-1">Заявена</th>
              <th>Статус</th>
              <th>Mode</th>
              <th>Run</th>
              <th>Грешка</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="py-1">{new Date(r.requested_at).toLocaleString("bg-BG")}</td>
                <td>{r.status}</td>
                <td>{r.mode}</td>
                <td>{r.run_id ?? "—"}</td>
                <td className="text-[#b13a1a]">{r.error ?? ""}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-black/40">
                  Няма заявки.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
