"use client";

import { useState } from "react";

type OrphanObject = {
  path: string;
  folder: string;
  sizeBytes: number;
  uploadedAt: string | null;
};

type ScanResult = {
  bucket: string;
  count: number;
  totalBytes: number;
  orphans: OrphanObject[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function StorageOrphansPanel() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runScan() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/storage/orphans", { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string })?.error ?? "Грешка при сканиране.");
      setScan(json as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при сканиране.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAll() {
    if (!scan?.orphans.length) return;
    if (!window.confirm(`Сигурни ли сте? Ще се изтрият ${scan.count} файла (${formatBytes(scan.totalBytes)}).`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/admin/api/storage/orphans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths: scan.orphans.map((o) => o.path) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string })?.error ?? "Грешка при изтриване.");
      const result = json as { deletedCount: number; freedBytes: number };
      setNotice(`Изтрити ${result.deletedCount} файла, освободени ${formatBytes(result.freedBytes)}.`);
      await runScan();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при изтриване.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runScan}
          disabled={loading || deleting}
          className="rounded-xl border border-black/[0.18] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7f6f3] disabled:opacity-50"
        >
          {loading ? "Сканиране…" : "Сканирай"}
        </button>
        {scan && scan.count > 0 && (
          <button
            type="button"
            onClick={deleteAll}
            disabled={deleting || loading}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Изтриване…" : `Изтрий всички (${scan.count})`}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {scan && (
        <div className="space-y-2">
          <p className="text-sm text-black/70">
            Bucket <code>{scan.bucket}</code>: {scan.count} orphan файла · {formatBytes(scan.totalBytes)}
            {" "}(изключени са файлове по-млади от 1 час)
          </p>
          {scan.count > 0 && (
            <div className="overflow-x-auto rounded-xl border border-black/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/[0.04] text-black/60">
                  <tr>
                    <th className="px-3 py-2">Папка</th>
                    <th className="px-3 py-2">Път</th>
                    <th className="px-3 py-2">Размер</th>
                    <th className="px-3 py-2">Качен</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.orphans.map((o) => (
                    <tr key={o.path} className="border-t border-black/5">
                      <td className="px-3 py-1.5">{o.folder}</td>
                      <td className="px-3 py-1.5 font-mono">{o.path}</td>
                      <td className="px-3 py-1.5">{formatBytes(o.sizeBytes)}</td>
                      <td className="px-3 py-1.5">{o.uploadedAt ? o.uploadedAt.slice(0, 10) : "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
