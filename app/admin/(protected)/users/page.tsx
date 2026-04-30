import Link from "next/link";
import { redirect } from "next/navigation";
import AdminUsersInteractive from "@/components/admin/AdminUsersInteractive";
import { getAdminContext } from "@/lib/admin/isAdmin";
import type { AdminUserListRow } from "@/lib/admin/adminUsersList";
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
  status: string;
  last_login: string;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.role && params.role !== "all") sp.set("role", params.role);
  if (params.has_organizer === "1") sp.set("has_organizer", "1");
  if (params.banned === "1") sp.set("banned", "1");
  if (params.status && params.status !== "active") sp.set("status", params.status);
  if (params.last_login && params.last_login !== "all") sp.set("last_login", params.last_login);
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = asString(params.q).trim();
  const role = asString(params.role);
  const hasOrganizer = asString(params.has_organizer);
  const banned = asString(params.banned);
  const status = asString(params.status);
  const lastLogin = asString(params.last_login);
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

  const qs = buildQueryString({
    q,
    role,
    has_organizer: hasOrganizer,
    banned,
    status,
    last_login: lastLogin,
    page,
  });
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
  const prevQs =
    currentPage > 1
      ? buildQueryString({ q, role, has_organizer: hasOrganizer, banned, status, last_login: lastLogin, page: currentPage - 1 })
      : "";
  const nextQs =
    currentPage < totalPages
      ? buildQueryString({ q, role, has_organizer: hasOrganizer, banned, status, last_login: lastLogin, page: currentPage + 1 })
      : "";

  const filterSummaryParts: string[] = [];
  if (q) filterSummaryParts.push(`търсене „${q}“`);
  if (status === "deleted") filterSummaryParts.push("само деактивирани");
  if (status === "all") filterSummaryParts.push("всички статуси");
  if (role && role !== "all") filterSummaryParts.push(`роля ${role}`);
  if (lastLogin === "recent") filterSummaryParts.push("скорошен вход");
  if (lastLogin === "stale") filterSummaryParts.push("неактивен вход");
  const queryLabel = filterSummaryParts.length ? `Филтри: ${filterSummaryParts.join(", ")}` : "";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Потребители</h1>
        <p className="mt-1 text-sm text-black/65">Оперативен списък — роли, статус и сигурност.</p>

        <form className="mt-4 space-y-3" method="get">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50 lg:col-span-2">
              Търсене (имейл или име)
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="Част от имейл или име…"
              />
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Статус акаунт
              <select
                name="status"
                defaultValue={status || "active"}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="active">Активни</option>
                <option value="deleted">Деактивирани</option>
                <option value="all">Всички</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Роля
              <select
                name="role"
                defaultValue={role || "all"}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="all">Всички</option>
                <option value="user">Потребител</option>
                <option value="organizer">Организатор</option>
                <option value="admin">Админ</option>
                <option value="super_admin">Super админ</option>
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
              Последен вход
              <select
                name="last_login"
                defaultValue={lastLogin || "all"}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="all">Всички</option>
                <option value="recent">Активен (90 дни)</option>
                <option value="stale">Неактивен</option>
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
        <AdminUsersInteractive
          rows={rows}
          total={total}
          currentPage={currentPage}
          perPage={perPage}
          totalPages={totalPages}
          prevQs={prevQs}
          nextQs={nextQs}
          queryLabel={queryLabel}
        />
      )}
    </div>
  );
}
