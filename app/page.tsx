import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import Container from "@/app/_components/ui/Container";
import Button from "@/app/_components/ui/Button";
import Badge from "@/app/_components/ui/Badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/_components/ui/Card";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import { getFestivals } from "@/lib/queries";
import { getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

export async function generateMetadata() {
  return {
    title: "Festivo — Discover festivals in Bulgaria",
    description: "Browse verified festivals, find dates, and plan weekends across Bulgaria.",
    alternates: {
      canonical: `${getBaseUrl()}/`,
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

function SkeletonGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`skeleton-${index}`} className="h-[320px] rounded-2xl border border-black/10 bg-white/60" />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const featured = await getFestivals({ free: true, sort: "soonest" }, 1, 6);
  const hasFeatured = featured.data.length > 0;

  return (
    <div className="space-y-16 pb-16 pt-10">
      <Container>
        <section className="space-y-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Фестивали в България.
              </h1>
              <p className="text-sm text-neutral-600 md:text-base">
                Чисто. Бързо. Само най-важното: дата, град, жанр, цена и план.
              </p>
            </div>

            <Card>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
                      Ключова дума
                    </label>
                    <Input placeholder="Търси..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">Град</label>
                    <Select defaultValue="">
                      <option value="">Всички</option>
                      <option value="sofia">Sofia</option>
                      <option value="plovdiv">Plovdiv</option>
                      <option value="varna">Varna</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">Кога</label>
                    <Select defaultValue="">
                      <option value="">Всеки ден</option>
                      <option value="today">Днес</option>
                      <option value="weekend">Уикенд</option>
                      <option value="month">Този месец</option>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-600">Намери най-доброто за твоя план.</div>
                  <Button variant="primary">Търси</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </Container>

      <Container>
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">��������</p>
              <h2 className="text-2xl font-semibold tracking-tight">�������� ���������</h2>
            </div>
            <Link href="/festivals" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">
              ��� ������ >
            </Link>
          </div>

          {hasFeatured ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.data.map((festival) => (
                <Card key={festival.id} className="flex h-full flex-col">
                  <CardHeader className="relative aspect-[16/10] border-b border-black/10 p-0">
                    {festival.image_url ? (
                      <Image src={festival.image_url} alt={festival.title} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-50" />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {festival.is_free ? <Badge>Безплатно</Badge> : <Badge variant="neutral">�������</Badge>}
                      {festival.category ? <Badge variant="neutral">{festival.category}</Badge> : null}
                    </div>
                    <h3 className="text-lg font-semibold">{festival.title}</h3>
                    <p className="text-sm text-neutral-600">
                      {festival.city ?? "Bulgaria"} • {formatDateRange(festival.start_date, festival.end_date)}
                    </p>
                  </CardContent>
                  <CardFooter className="mt-auto flex items-center justify-between text-sm">
                    <Link href={`/festival/${festival.slug}`} className="font-semibold">
                      Детайли →
                    </Link>
                    <Button variant="ghost">Добави</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <SkeletonGrid />
          )}
        </section>
      </Container>
    </div>
  );
}
