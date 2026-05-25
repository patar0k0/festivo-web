import FestivalsTable from "@/components/admin/FestivalsTable";
import {
  loadAdminFestivalCategoryOptions,
  loadAdminFestivalCityOptions,
  type AdminFestivalsFilterStatus,
} from "@/lib/admin/festivalListFilterOptions";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { assessPendingFestivalQuality, type PendingQualityBucket } from "@/lib/admin/pendingFestivalQuality";
import { headers } from "next/headers";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;
const STATUS_FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

const STATUS_LABELS: Record<string, string> = {
  all: "Всички",
  draft: "Чернова",
  verified: "Потвърден",
  rejected: "Отхвърлен",
  archived: "Архивиран",
};

const TIME_OPTIONS = [
  { value: "upcoming", label: "Предстоящи (включително текущи)" },
  { value: "past", label: "Минали" },
  { value: "all", label: "Всички" },
] as const;
type TimeValue = (typeof TIME_OPTIONS)[number]["value"];
const DEFAULT_TIME: TimeValue = "upcoming";

function asTime(raw: string): TimeValue {
  return (TIME_OPTIONS as readonly { value: string }[]).some((o) => o.value === raw)
    ? (raw as TimeValue)
    : DEFAULT_TIME;
}

const SORT_OPTIONS = [
  { value: "start_date_asc", label: "Дата (възх.) — какво идва" },
  { value: "start_date_desc", label: "Дата (низх.) — скорошно минали" },
  { value: "updated_desc", label: "Последно редактиран" },
  { value: "created_desc", label: "Скоро добавени" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];
const DEFAULT_SORT: SortValue = "start_date_asc";

function asSort(raw: string): SortValue {
  if ((SORT_OPTIONS as readonly { value: string }[]).some((opt) => opt.value === raw)) {
    return raw as SortValue;
  }
  return DEFAULT_SORT;
}

type SearchParams = Record<string, string | string[] | undefined>;

export type AdminFestivalRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  city_id: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  occurrence_dates?: unknown;
  location_name: string | null;
  organizer_name: string | null;
  hero_image: string | null;
  tags: unknown;
  category: string | null;
  is_free: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | null;
  updated_at: string | null;
  source_type: string | null;
  quality_score: number;
  quality_bucket: PendingQualityBucket;
  missing_fields: string[];
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function statusToFilterScope(status: string): AdminFestivalsFilterStatus {
  if (status === "all") return "all";
  if (STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    return status as (typeof STATUS_OPTIONS)[number];
  }
  return "verified";
}

export default async function AdminFestivalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawStatus = asString(params.status);
  const status =
    rawStatus === "all" || STATUS_OPTIONS.includes(rawStatus as (typeof STATUS_OPTIONS)[number]) ? rawStatus : "verified";
  const cityId = asString(params.city_id);
  const category = asString(params.category);
  const free = asString(params.free);
  const q = asString(params.q);
  const sort = asSort(asString(params.sort));
  const time = asTime(asString(params.time));
  const deleted = asString(params.deleted) === "1";
  const qualityFilter = asString(params.quality) as PendingQualityBucket | "";

  const statusScope = statusToFilterScope(status);

  const queryString = new URLSearchParams();
  if (status === "all") {
    queryString.set("status", "all");
  } else if (STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    queryString.set("status", status);
  }
  if (cityId) queryString.set("city_id", cityId);
  if (category) queryString.set("category", category);
  if (free) queryString.set("free", free);
  if (q) queryString.set("q", q);
  if (sort !== DEFAULT_SORT) queryString.set("sort", sort);
  if (time !== DEFAULT_TIME) queryString.set("time", time);

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const admin = await getAdminContext();
  const [listResponse, categoryOptions, cityOptions] = await Promise.all([
    fetch(`${baseUrl}/admin/api/festivals?${queryString.toString()}`, {
      cache: "no-store",
      headers: {
        cookie: requestHeaders.get("cookie") ?? "",
      },
    }),
    admin ? loadAdminFestivalCategoryOptions(admin.supabase, statusScope) : Promise.resolve([] as string[]),
    admin ? loadAdminFestivalCityOptions(admin.supabase, statusScope) : Promise.resolve([]),
  ]);

  type RawRow = Omit<AdminFestivalRow, "quality_score" | "quality_bucket" | "missing_fields">;
  const payload = (await listResponse.json().catch(() => ({}))) as { error?: string; rows?: RawRow[] };
  const apiError = payload.error;

  const allRows: AdminFestivalRow[] = (payload.rows ?? []).map((row) => {
    const quality = assessPendingFestivalQuality({
      ...row,
      city_name_display: row.city,
    });
    return {
      ...row,
      quality_score: quality.quality_score,
      quality_bucket: quality.quality_bucket,
      missing_fields: quality.missing_fields,
    };
  });

  const qualityCounts = allRows.reduce<Record<PendingQualityBucket, number>>(
    (acc, row) => {
      acc[row.quality_bucket] += 1;
      return acc;
    },
    { ready: 0, needs_fix: 0, weak: 0 },
  );

  const rows = qualityFilter ? allRows.filter((row) => row.quality_bucket === qualityFilter) : allRows;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Фестивали</h1>
        <p className="mt-1 text-sm text-black/65">Филтрирай и управлявай фестивалите в системата.</p>

        <form className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Изглед:
            </span>
            {TIME_OPTIONS.map((opt) => {
              const active = time === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                      : "border-black/[0.12] bg-white text-black/70 hover:bg-black/[0.04]"
                  }`}
                >
                  <input
                    type="radio"
                    name="time"
                    value={opt.value}
                    defaultChecked={active}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Статус
              <select
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                {STATUS_FILTER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABELS[item] ?? item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Град
              <select
                name="city_id"
                defaultValue={cityId}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                {cityOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Категория
              <select
                name="category"
                defaultValue={category}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Всички</option>
                {categoryOptions.map((slug) => (
                  <option key={slug} value={slug}>
                    {labelForPublicCategory(slug)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Вход
              <select name="free" defaultValue={free} className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm">
                <option value="">Всички</option>
                <option value="1">Безплатен</option>
                <option value="0">Платен</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Търси заглавие
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="Съдържа…"
              />
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Сортиране
              <select
                name="sort"
                defaultValue={sort}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Preserve quality filter across form submissions */}
          {qualityFilter ? <input type="hidden" name="quality" value={qualityFilter} /> : null}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Приложи
            </button>
            <a
              href="/admin/festivals"
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Изчисти
            </a>
          </div>
        </form>
      </div>

      {deleted ? (
        <div className="rounded-xl border border-[#18a05e]/20 bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">Фестивалът е изтрит успешно.</div>
      ) : null}

      {!listResponse.ok ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 text-sm text-[#b13a1a]">{apiError ?? "Грешка при зареждане на фестивали."}</div>
      ) : (
        <FestivalsTable rows={rows} qualityFilter={qualityFilter} qualityCounts={qualityCounts} />
      )}
    </div>
  );
}
