import FestivalsTable from "@/components/admin/FestivalsTable";
import {
  loadAdminFestivalCategoryOptions,
  loadAdminFestivalCityOptions,
  type AdminFestivalsFilterStatus,
} from "@/lib/admin/festivalListFilterOptions";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { headers } from "next/headers";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;
const STATUS_FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

// Time filter: by default the admin list hides past festivals so the active
// workload stays focused on what needs moderation. "Past" + "All" are
// available for audit / cleanup tasks.
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

type AdminFestivalRow = {
  id: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  occurrence_dates?: unknown;
  category: string | null;
  is_free: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | null;
  updated_at: string | null;
  source_type: string | null;
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

  const payload = (await listResponse.json().catch(() => ({}))) as { error?: string; rows?: AdminFestivalRow[] };
  const apiError = payload.error;
  const rows = payload.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-2xl font-black tracking-tight">Festivals</h1>
        <p className="mt-1 text-sm text-black/65">Филтрирай и управлявай фестивалите в системата.</p>

        <form className="mt-3 space-y-2">
          {/* Time scope chips — primary "view mode" toggle.
              Visually separated from the form filter grid below because it's
              a different concept: status/city/category narrow the dataset,
              while "time" decides which slice of time is shown. */}
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
              Status
              <select
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                {STATUS_FILTER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              City
              <select
                name="city_id"
                defaultValue={cityId}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">All</option>
                {cityOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Category
              <select
                name="category"
                defaultValue={category}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">All</option>
                {categoryOptions.map((slug) => (
                  <option key={slug} value={slug}>
                    {labelForPublicCategory(slug)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Free
              <select name="free" defaultValue={free} className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm">
                <option value="">All</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Search title
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-sm"
                placeholder="Title contains…"
              />
            </label>

            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
              Sort
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

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="submit"
              className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Apply filters
            </button>
            <a
              href="/admin/festivals"
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Reset
            </a>
          </div>
        </form>
      </div>

      {deleted ? (
        <div className="rounded-xl border border-[#18a05e]/20 bg-[#18a05e]/10 px-3 py-2 text-sm text-[#0e7a45]">Festival deleted successfully.</div>
      ) : null}

      {!listResponse.ok ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 text-sm text-[#b13a1a]">{apiError ?? "Failed to load festivals."}</div>
      ) : (
        <FestivalsTable rows={rows} />
      )}
    </div>
  );
}
