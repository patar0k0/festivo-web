import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import FiltersSidebar from "@/components/FiltersSidebar";
import Pagination from "@/components/Pagination";
import Container from "@/app/_components/ui/Container";
import Badge from "@/app/_components/ui/Badge";
import Button from "@/app/_components/ui/Button";
import { Card, CardContent, CardHeader } from "@/app/_components/ui/Card";
import Select from "@/app/_components/ui/Select";
import { parseFilters, withDefaultFilters } from "@/lib/filters";
import { getFestivals } from "@/lib/queries";
import { getBaseUrl, listMeta } from "@/lib/seo";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export const revalidate = 3600;

export async function generateMetadata() {
  const meta = listMeta();
  return {
    ...meta,
    alternates: {
      canonical: `${getBaseUrl()}/festivals`,
    },
  };
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export default async function FestivalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = withDefaultFilters(parseFilters(searchParams));
  const page = Number(searchParams.page ?? 1);
  const data = await getFestivals(filters, Number.isNaN(page) ? 1 : page, 12);
  const { configured } = getSupabaseEnv();
  const showBanner = !configured && process.env.NODE_ENV !== "production";
  const sortValue = filters.sort ?? "soonest";

  return (
    <Container>
      <div className="space-y-6 pb-10 pt-8">
        {showBanner ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Supabase env vars are missing. Set them in Vercel or your local environment to load festivals.
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600"></p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl"></h1>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            {filters.city?.length ? <input type="hidden" name="city" value={filters.city.join(",")} /> : null}
            {filters.region?.length ? <input type="hidden" name="region" value={filters.region.join(",")} /> : null}
            {filters.from ? <input type="hidden" name="from" value={filters.from} /> : null}
            {filters.to ? <input type="hidden" name="to" value={filters.to} /> : null}
            {filters.cat?.length ? <input type="hidden" name="cat" value={filters.cat.join(",")} /> : null}
            {filters.free !== undefined ? (
              <input type="hidden" name="free" value={filters.free ? "1" : "0"} />
            ) : null}
            {filters.month ? <input type="hidden" name="month" value={filters.month} /> : null}
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600"></label>
            <Select name="sort" defaultValue={sortValue} className="min-w-[180px]">
              <option value="soonest">-</option>
              <option value="curated"></option>
              <option value="nearest">-</option>
            </Select>
            <Button type="submit" variant="ghost">
              
            </Button>
          </form>
        </div>

        <div className="space-y-6 lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8 lg:space-y-0">
          <div className="lg:hidden">
            <Card>
              <CardHeader className="border-b border-black/10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600"></h2>
              </CardHeader>
              <CardContent>
                <FiltersSidebar
                  initialFilters={filters}
                  className="w-full max-w-none border-0 bg-transparent p-0 shadow-none"
                />
              </CardContent>
            </Card>
          </div>

          <div className="hidden lg:block">
            <Card>
              <CardHeader className="border-b border-black/10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600"></h2>
              </CardHeader>
              <CardContent>
                <FiltersSidebar
                  initialFilters={filters}
                  className="w-full max-w-none border-0 bg-transparent p-0 shadow-none"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {data.data.length ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {data.data.map((festival) => (
                  <Card key={festival.slug} className="flex h-full flex-col">
                    <CardHeader className="relative aspect-[16/10] border-b border-black/10 p-0">
                      {festival.image_url ? (
                        <Image src={festival.image_url} alt={festival.title} fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-50" />
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {festival.is_free ? <Badge></Badge> : null}
                        {festival.category ? <Badge variant="neutral">{festival.category}</Badge> : null}
                      </div>
                      <Link href={`/festival/${festival.slug}`} className="text-lg font-semibold">
                        {festival.title}
                      </Link>
                      <p className="text-sm text-neutral-600">
                        {festival.city ?? "Bulgaria"}  {formatDateRange(festival.start_date, festival.end_date)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent>
                  <p className="text-sm text-neutral-600">     .</p>
                </CardContent>
              </Card>
            )}

            <Pagination page={data.page} totalPages={data.totalPages} basePath="/festivals" filters={filters} />
          </div>
        </div>
      </div>
    </Container>
  );
}
