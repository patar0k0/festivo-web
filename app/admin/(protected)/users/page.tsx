import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { emailLocalPart, type AdminUserListRow } from "@/lib/admin/adminUsersList";
import { headers } from "next/headers";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildQueryString(params: {
  q: string;
  role: string;
  has_organizer: string;
  banned: string;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.role === "admin") sp.set("role", "admin");
  if (params.has_organizer === "1") sp.set("has_organizer", "1");
  if (params.banned === "1") sp.set("banned", "1");
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

const STATUS_LABEL: Record<"active" | "unconfirmed" | "banned", { text: string; className: string }> = {
  active: { text: "Активен", className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90" },
  unconfirmed: { text: "Непотвърден", className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90" },
  banned: { text: "Блокиран", className: "bg-red-100 text-red-950 ring-1 ring-red-200/90" },
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

function rowStatus(row: AdminUserListRow): "active" | "unconfirmed" | "banned" {
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

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = asString(params.q).trim();
  const role = asString(params.role);
  const hasOrganizer = asString(params.has_organizer);
  const banned = asString(params.banned);
  const pageRaw = asString(params.page);
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);

  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/users");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const qs = buildQueryString({ q, role, has_organizer: hasOrganizer, banned, page });
  const listResponse = await fetch(`${baseUrl}/admin/api/users?${qs}`, {
    cache: "no-store",
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
  });

  const payload = (await listResponse.json().catch(() => ({}))) as {
    error?: string;
    rows?: AdminUserListRow[];
    total?: number;
    page?: number;
    perPage?: number;
  };

  const apiError = payload.error;
  const rows = payload.rows ?? [];
  const total = typeof payload.total === "number" ? payload.total : 0;
  const perPage = typeof payload.perPage === "number" ? payload.perPage : 50;
  const currentPage = typeof payload.page === "number" ? payload.page : page;

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  const prevQs =
    currentPage > 1
      ? buildQueryString({ q, role, has_organizer: hasOrganizer, banned, page: currentPage - 1 })
      : "";
  const nextQs =
    currentPage < totalPages
      ? buildQueryString({ q, role, has_organizer: hasOrganizer, banned, page: currentPage + 1 })
      : "";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Потребители</h1>
        <p className="mt-1 text-sm text-black/65">Оперативен списък — кой е потребителят с един поглед.</p>

        <form className="mt-4 space-y-3" method="get">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50 lg:col-span-2">
              Търсене по имейл
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="Част от имейл…"
              />
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Роля
              <select
                name="role"
                defaultValue={role === "admin" ? "admin" : ""}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                <option value="admin">Само админи</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Организатор
              <select
                name="has_organizer"
                defaultValue={hasOrganizer === "1" ? "1" : ""}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                <option value="1">С активна връзка</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Блокиране
              <select
                name="banned"
                defaultValue={banned === "1" ? "1" : ""}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                <option value="1">Само блокирани</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Приложи
            </button>
            <Link
              href="/admin/users"
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Нулирай
            </Link>
          </div>
        </form>
      </div>

      {!listResponse.ok ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 text-sm text-[#b13a1a]">
          {apiError ?? "Неуспешно зареждане на потребители."}
        </div>
      ) : (
        <>
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
                  <th className="px-4 py-3">Имейл</th>
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
                  return (
                    <tr key={row.id} className="border-t border-black/[0.06]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#0c0e14]">{row.email ?? "—"}</div>
                        <div className="text-xs text-black/50">{emailLocalPart(row.email)}</div>
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
                        {row.is_admin ? (
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-violet-100 text-violet-950 ring-1 ring-violet-200/90">
                            ADMIN
                          </span>
                        ) : (
                          <span className="text-black/40">—</span>
                        )}
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
                      <td className="px-4 py-3 text-black/70">
                        {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : "Никога"}
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
                    <td colSpan={8} className="px-4 py-8 text-center text-black/60">
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
      )}
    </div>
  );
}
