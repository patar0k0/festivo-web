import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getAdminContext } from "@/lib/admin/isAdmin";
import { MarkReviewedButton } from "@/components/admin/MarkReviewedButton";

const CATEGORY_LABELS: Record<string, string> = {
  wrong_info: "Грешна дата/място/цена",
  wrong_location: "Грешно местоположение",
  broken_link: "Счупен линк/снимка",
  event_cancelled: "Фестивалът е отменен",
  other: "Друго",
};

const PER_PAGE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function AdminFestivalReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/festival-reports");
  }

  const params = await searchParams;
  const reviewed = asString(params.reviewed); // "" | "0" | "1"
  const pageRaw = parseInt(asString(params.page) || "1", 10);
  const page = isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const qs = new URLSearchParams();
  if (reviewed === "0" || reviewed === "1") qs.set("reviewed", reviewed);
  if (page > 1) qs.set("page", String(page));
  qs.set("perPage", String(PER_PAGE));

  const res = await fetch(`${baseUrl}/admin/api/festival-reports?${qs.toString()}`, {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    rows?: Array<{
      id: string;
      category: string;
      message: string;
      reporter_ip: string | null;
      created_at: string;
      reviewed: boolean;
      festival: { id: string; title: string; slug: string | null } | null;
    }>;
    total?: number;
    page?: number;
    perPage?: number;
    error?: string;
  };

  const rows = payload.rows ?? [];
  const total = payload.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function buildHref(p: { reviewed?: string; page?: number }) {
    const sp = new URLSearchParams();
    const r = p.reviewed ?? reviewed;
    if (r === "0" || r === "1") sp.set("reviewed", r);
    if ((p.page ?? page) > 1) sp.set("page", String(p.page ?? page));
    const q = sp.toString();
    return `/admin/festival-reports${q ? `?${q}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <h1 className="text-2xl font-black tracking-tight">Сигнали за проблеми</h1>
        <p className="mt-1 text-sm text-black/65">
          Сигнали от потребители за грешна информация или проблеми с фестивали.
          {total > 0 && <span className="ml-2 text-black/40">({total} общо)</span>}
        </p>

        <div className="mt-4 flex gap-2">
          {[
            { label: "Всички", value: "" },
            { label: "Чакащи", value: "0" },
            { label: "Разгледани", value: "1" },
          ].map(({ label, value }) => (
            <Link
              key={value}
              href={buildHref({ reviewed: value, page: 1 })}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                reviewed === value
                  ? "bg-[#0c0e14] text-white"
                  : "border border-black/[0.12] bg-white hover:bg-black/[0.04]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90">
        {payload.error ? (
          <p className="p-6 text-sm text-[#b13a1a]">{payload.error}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.14em] text-black/55">
              <tr>
                <th className="px-4 py-3">Фестивал</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Съобщение</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-black/[0.06]">
                  <td className="px-4 py-3 font-semibold">
                    {row.festival ? (
                      <Link
                        href={
                          row.festival.slug
                            ? `/festival/${row.festival.slug}`
                            : `/admin/festivals/${row.festival.id}`
                        }
                        className="hover:underline"
                        target="_blank"
                      >
                        {row.festival.title}
                      </Link>
                    ) : (
                      <span className="text-black/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-black/70">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-black/70">
                    <span className="line-clamp-2">{row.message}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-black/70">
                    {new Date(row.created_at).toLocaleDateString("bg-BG", { timeZone: "Europe/Sofia" })}
                  </td>
                  <td className="px-4 py-3">
                    {row.reviewed ? (
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80">
                        Разгледан
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-200/80">
                        Чакащ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!row.reviewed && <MarkReviewedButton reportId={row.id} />}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-black/50">
                    Няма сигнали.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 text-xs text-black/55">
            <span>
              Страница {page} от {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildHref({ page: page - 1 })}
                  className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                >
                  ← Предишна
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildHref({ page: page + 1 })}
                  className="rounded-md border border-black/[0.12] px-3 py-1 font-semibold uppercase tracking-[0.1em] hover:bg-black/[0.04]"
                >
                  Следваща →
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
