import { festivalCategories, festivalCategoryLabels } from "@/components/CategoryChips";
import FestivalsTable from "@/components/admin/FestivalsTable";
import { headers } from "next/headers";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

type AdminFestivalRow = {
  id: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  category: string | null;
  is_free: boolean | null;
  status: "draft" | "verified" | "rejected" | "archived" | null;
  updated_at: string | null;
  source_type: string | null;
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function AdminFestivalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = asString(params.status) || "draft";
  const city = asString(params.city);
  const category = asString(params.category);
  const free = asString(params.free);
  const q = asString(params.q);

  const queryString = new URLSearchParams();
  if (status && STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) queryString.set("status", status);
  if (city) queryString.set("city", city);
  if (category) queryString.set("category", category);
  if (free) queryString.set("free", free);
  if (q) queryString.set("q", q);

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const response = await fetch(`${baseUrl}/admin/api/festivals?${queryString.toString()}`, {
    cache: "no-store",
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; rows?: AdminFestivalRow[] };
  const apiError = payload.error;
  const rows = payload.rows ?? [];
  const missingServiceRole = response.status === 500 && typeof apiError === "string" && apiError.includes("Missing SUPABASE_SERVICE_ROLE_KEY");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Festivals</h1>
        <p className="mt-2 text-sm text-black/65">Филтрирай и управлявай фестивалите в системата.</p>

        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Status
            <select name="status" defaultValue={status} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            City
            <input name="city" defaultValue={city} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm" />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Category
            <select name="category" defaultValue={category} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm">
              <option value="">All</option>
              {festivalCategories.map((item) => (
                <option key={item} value={item}>
                  {festivalCategoryLabels[item] ?? item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Free
            <select name="free" defaultValue={free} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">
            Search title
            <input name="q" defaultValue={q} className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm" />
          </label>

          <div className="flex items-end gap-2 xl:col-span-5">
            <button type="submit" className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Apply filters
            </button>
            <a href="/admin/festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
              Reset
            </a>
          </div>
        </form>
      </div>

      {!response.ok ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
          {missingServiceRole ? "Missing SUPABASE_SERVICE_ROLE_KEY. Set env in Vercel." : apiError ?? "Failed to load festivals."}
        </div>
      ) : (
        <FestivalsTable rows={rows} />
      )}
    </div>
  );
}
