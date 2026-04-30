"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminUserListRow } from "@/lib/admin/adminUsersList";
import { emailLocalPart } from "@/lib/admin/adminUsersList";
import { appRoleLabelBg } from "@/lib/admin/appRoles";
import type { AppRole } from "@/lib/admin/appRoles";
import { formatDistanceToNow } from "date-fns";
import { bg } from "date-fns/locale";

type Props = {
  rows: AdminUserListRow[];
  total: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
  prevQs: string;
  nextQs: string;
  queryLabel: string;
};

const STATUS_LABEL: Record<"active" | "unconfirmed" | "banned" | "deleted", { text: string; className: string }> = {
  active: { text: "Активен", className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90" },
  unconfirmed: { text: "Непотвърден", className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90" },
  banned: { text: "Блокиран", className: "bg-red-100 text-red-950 ring-1 ring-red-200/90" },
  deleted: { text: "Деактивиран", className: "bg-slate-200 text-slate-900 ring-1 ring-slate-300/90" },
};

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  google: {
    label: "Google",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
  apple: {
    label: "Apple",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
  email: {
    label: "Имейл",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
};

function rowStatus(row: AdminUserListRow): "active" | "unconfirmed" | "banned" | "deleted" {
  if (row.deleted_at) return "deleted";
  if (row.banned_until && new Date(row.banned_until) > new Date()) return "banned";
  if (!row.email_confirmed_at) return "unconfirmed";
  return "active";
}

function providerBadge(provider: string) {
  const key = provider.toLowerCase();
  if (PROVIDER_BADGE[key]) return PROVIDER_BADGE[key];
  return {
    label: provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "—",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  };
}

function roleBadgeClass(role: AppRole): string {
  if (role === "admin" || role === "super_admin") {
    return "bg-violet-100 text-violet-950 ring-1 ring-violet-200/90";
  }
  if (role === "organizer") {
    return "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90";
  }
  return "bg-black/[0.04] text-black/60 ring-1 ring-black/[0.08]";
}

export default function AdminUsersInteractive({
  rows,
  total,
  currentPage,
  perPage,
  totalPages,
  prevQs,
  nextQs,
  queryLabel,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"" | "ban" | "delete" | "role">("");
  const [rolePick, setRolePick] = useState<AppRole>("user");
  const [error, setError] = useState("");

  const selectedList = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    if (selected.size === rows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  async function postBulk(action: "ban" | "soft_delete" | "set_role") {
    setError("");
    if (selectedList.length === 0) {
      setError("Изберете поне един потребител.");
      return;
    }
    setBusy(action === "ban" ? "ban" : action === "soft_delete" ? "delete" : "role");
    try {
      const body: Record<string, unknown> = { action: action === "soft_delete" ? "soft_delete" : action, user_ids: selectedList };
      if (action === "set_role") {
        body.role = rolePick;
      }
      const res = await fetch("/admin/api/users/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; errors?: Record<string, string> } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      const failed = payload?.errors && Object.keys(payload.errors).length;
      if (failed) {
        setError(`Частичен неуспех: ${failed} потребители.`);
      }
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка.");
    } finally {
      setBusy("");
    }
  }

  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  return (
    <>
      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.1em] text-black/50">Масови действия</span>
        <label className="inline-flex items-center gap-1 text-black/70">
          <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAllOnPage} />
          Всички на страницата
        </label>
        <select
          value={rolePick}
          onChange={(e) => setRolePick(e.target.value as AppRole)}
          className="rounded border border-black/[0.12] bg-white px-2 py-1 text-[11px] font-medium"
        >
          <option value="user">Роля: потребител</option>
          <option value="organizer">Роля: организатор</option>
          <option value="admin">Роля: админ</option>
          <option value="super_admin">Роля: super админ</option>
        </select>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void postBulk("set_role")}
          className="rounded-lg border border-black/[0.12] bg-white px-2.5 py-1 font-semibold uppercase tracking-[0.08em] hover:bg-black/[0.04] disabled:opacity-45"
        >
          {busy === "role" ? "…" : "Задай роля"}
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void postBulk("ban")}
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 font-semibold uppercase tracking-[0.08em] text-red-950 hover:bg-red-100 disabled:opacity-45"
        >
          {busy === "ban" ? "…" : "Блокирай"}
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void postBulk("soft_delete")}
          className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 font-semibold uppercase tracking-[0.08em] text-white hover:bg-red-700 disabled:opacity-45"
        >
          {busy === "delete" ? "…" : "Деактивирай"}
        </button>
        <span className="text-black/45">{queryLabel}</span>
      </div>

      <p className="text-sm text-black/60">
        {total === 0 ? (
          "Няма намерени потребители."
        ) : (
          <>
            Показани {from}–{to} от {total}
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
        <table className="min-w-full text-sm">
          <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
            <tr>
              <th className="px-2 py-3 w-8" aria-label="Избор" />
              <th className="px-4 py-3">Имейл / име</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Роля</th>
              <th className="px-4 py-3">Организатор</th>
              <th className="px-4 py-3">Регистриран</th>
              <th className="px-4 py-3">Последен вход</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const statusKey = rowStatus(row);
              const status = STATUS_LABEL[statusKey];
              const prov = providerBadge(row.provider);
              const lastSeen = row.last_sign_in_at
                ? formatDistanceToNow(new Date(row.last_sign_in_at), { addSuffix: true, locale: bg })
                : "никога";
              return (
                <tr key={row.id} className={`border-t border-black/[0.06] ${row.deleted_at ? "bg-black/[0.02]" : ""}`}>
                  <td className="px-2 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      disabled={Boolean(row.deleted_at)}
                      aria-label={`Избор ${row.email ?? row.id}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0c0e14]">{row.email ?? "—"}</div>
                    <div className="text-xs text-black/50">
                      {row.full_name ?? emailLocalPart(row.email)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${status.className}`}
                    >
                      {status.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${prov.className}`}
                    >
                      {prov.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${roleBadgeClass(row.app_role)}`}
                    >
                      {appRoleLabelBg(row.app_role).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-black/80">{row.organizer_count}</span>
                      {row.pending_claim_count > 0 ? (
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-amber-100 text-amber-950 ring-1 ring-amber-200/90">
                          ЧАКАЩ
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-black/70">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-black/70" title={row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString("bg-BG") : undefined}>
                    {lastSeen}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${row.id}`}
                      className="inline-flex items-center rounded-md border border-black/[0.12] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                    >
                      Детайли
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-black/60">
                  Няма редове за тази страница.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-black/50">
            Страница {currentPage} от {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            {prevQs ? (
              <Link
                href={`/admin/users?${prevQs}`}
                className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
              >
                Предишна
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                Предишна
              </span>
            )}
            {nextQs ? (
              <Link
                href={`/admin/users?${nextQs}`}
                className="inline-flex items-center rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
              >
                Следваща
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/35">
                Следваща
              </span>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
