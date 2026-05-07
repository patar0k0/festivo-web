"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminUserListRow } from "@/lib/admin/adminUsersList";
import { emailLocalPart } from "@/lib/admin/adminUsersList";
import type { AppRole } from "@/lib/admin/appRoles";
import { formatDistanceToNow } from "date-fns";
import { bg } from "date-fns/locale";
import RoleBadge from "@/components/admin/RoleBadge";
import StatusBadge, { deriveUserAccountStatus } from "@/components/admin/StatusBadge";

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

function providerBadge(provider: string) {
  const key = provider.toLowerCase();
  if (PROVIDER_BADGE[key]) return PROVIDER_BADGE[key];
  return {
    label: provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "—",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  };
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
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        failed?: Array<{ id: string; error: string }>;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Неуспех.");
      }
      const failedCount = payload?.failed?.length ?? 0;
      if (failedCount) {
        setError(`Частичен неуспех: ${failedCount} потребители.`);
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

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 gap-y-2">
          <span className="font-semibold uppercase tracking-[0.1em] text-gray-500">Масови действия</span>
          {selected.size > 0 ? (
            <span className="text-xs font-medium text-gray-700">
              Избрани: {selected.size} {selected.size === 1 ? "потребител" : "потребителя"}
            </span>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-2 text-gray-700">
            <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAllOnPage} />
            Избери всички на страницата
          </label>
          <select
            value={rolePick}
            onChange={(e) => setRolePick(e.target.value as AppRole)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800"
            aria-label="Роля за назначаване"
          >
            <option value="user">Потребител</option>
            <option value="organizer">Организатор</option>
            <option value="admin">Админ</option>
            <option value="super_admin">Super админ</option>
          </select>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postBulk("set_role")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-45"
          >
            {busy === "role" ? "…" : "Задай роля"}
          </button>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postBulk("ban")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-amber-700 shadow-sm hover:bg-amber-100 disabled:opacity-45"
          >
            {busy === "ban" ? "…" : "Блокирай"}
          </button>
        </div>

        <div className="border-t border-gray-200" aria-hidden />

        <div className="flex flex-wrap items-center justify-between gap-3 gap-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-800/90">Опасно</span>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => void postBulk("soft_delete")}
            className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-white shadow-sm hover:bg-red-700 disabled:opacity-45"
          >
            {busy === "delete" ? "…" : "Изтри"}
          </button>
        </div>

        {queryLabel ? <p className="text-[11px] text-gray-500">{queryLabel}</p> : null}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-800">Няма намерени потребители</p>
          <p className="max-w-sm text-xs text-gray-500">Промени филтрите или търсенето</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Показани {from}–{to} от {total}
          </p>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-3" aria-label="Избор" />
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
                  const statusKind = deriveUserAccountStatus(row);
                  const prov = providerBadge(row.provider);
                  const lastSeen = row.last_sign_in_at
                    ? formatDistanceToNow(new Date(row.last_sign_in_at), { addSuffix: true, locale: bg })
                    : "никога";
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-default border-t border-gray-200 ${row.deleted_at ? "bg-gray-50/60" : ""}`}
                    >
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
                        <div className="text-xs text-gray-500">
                          {row.full_name ?? emailLocalPart(row.email)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind={statusKind} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight ${prov.className}`}
                        >
                          {prov.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={row.app_role} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-gray-800">{row.organizer_count}</span>
                          {row.pending_claim_count > 0 ? (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-amber-100 text-amber-950 ring-1 ring-amber-200/90">
                              ЧАКАЩ
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600" title={row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString("bg-BG") : undefined}>
                        {lastSeen}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${row.id}`}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-gray-900 shadow-sm hover:bg-gray-50"
                        >
                          Детайли
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-600">
                      Няма редове за тази страница.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Страница {currentPage} от {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            {prevQs ? (
              <Link
                href={`/admin/users?${prevQs}`}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] shadow-sm hover:bg-gray-50"
              >
                Предишна
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                Предишна
              </span>
            )}
            {nextQs ? (
              <Link
                href={`/admin/users?${nextQs}`}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] shadow-sm hover:bg-gray-50"
              >
                Следваща
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                Следваща
              </span>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
