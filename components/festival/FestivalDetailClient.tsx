"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import Badge from "@/components/ui/Badge";
import EventCard from "@/components/ui/EventCard";
import Select from "@/components/ui/Select";
import type { Festival, FestivalDay, FestivalMedia, FestivalScheduleItem } from "@/lib/types";

type Props = {
  festival: Festival;
  media: FestivalMedia[];
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
  dateText: string;
  venueText: string;
  mapHref: string | null;
  citySlug: string | null;
  calendarMonth: string | null;
  relatedFestivals: Festival[];
};

type GroupedDay = {
  id: string;
  label: string;
  items: FestivalScheduleItem[];
};

type ReminderValue = "none" | "24h" | "same_day_09";

function formatDayLabel(day: FestivalDay): string {
  if (day.title) return day.title;
  if (!day.date) return "Ден";
  try {
    return format(parseISO(day.date), "d MMMM");
  } catch {
    return day.date;
  }
}

function sortScheduleItems(items: FestivalScheduleItem[]): FestivalScheduleItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.start_time ?? "99:99";
    const bTime = b.start_time ?? "99:99";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
  });
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  const from = start ? start.slice(0, 5) : "";
  const to = end ? end.slice(0, 5) : "";
  if (from && to) return `${from} - ${to}`;
  return from || "Час предстои";
}

function categoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const labels: Record<string, string> = {
    music: "Музика",
    folk: "Фолклор",
    arts: "Изкуство",
    food: "Храна",
    cultural: "Култура",
    sports: "Спорт",
    film: "Кино",
    theater: "Театър",
  };
  return labels[category.toLowerCase()] ?? category;
}

function getGroupedDays(days: FestivalDay[], items: FestivalScheduleItem[]): GroupedDay[] {
  if (!days.length) {
    if (!items.length) return [];
    return [
      {
        id: "all",
        label: "Програма",
        items: sortScheduleItems(items),
      },
    ];
  }

  return days.map((day) => ({
    id: String(day.id),
    label: formatDayLabel(day),
    items: sortScheduleItems(items.filter((item) => String(item.day_id) === String(day.id))),
  }));
}

function isImageMedia(type?: string | null): boolean {
  if (!type) return true;
  return type.toLowerCase().includes("image");
}

export default function FestivalDetailClient({
  festival,
  media,
  days,
  scheduleItems,
  dateText,
  venueText,
  mapHref,
  citySlug,
  calendarMonth,
  relatedFestivals,
}: Props) {
  const groupedDays = useMemo(() => getGroupedDays(days, scheduleItems), [days, scheduleItems]);
  const [activeDayId, setActiveDayId] = useState(groupedDays[0]?.id ?? "");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [reminder, setReminder] = useState<ReminderValue>("none");

  const displayedDay = groupedDays.find((day) => day.id === activeDayId) ?? groupedDays[0] ?? null;
  const selectedItems = useMemo(
    () =>
      sortScheduleItems(
        scheduleItems.filter((item) => selectedItemIds.has(String(item.id))),
      ),
    [scheduleItems, selectedItemIds],
  );

  const imageMedia = media.filter((item) => isImageMedia(item.type) && Boolean(item.url));
  const heroImage = festival.image_url ?? imageMedia[0]?.url ?? null;
  const primaryCta = mapHref ? { label: "Навигация", href: mapHref } : null;
  const secondaryCta = festival.ticket_url
    ? { label: "Билети", href: festival.ticket_url }
    : festival.website_url
      ? { label: "Уебсайт", href: festival.website_url }
      : null;
  const categoryText = categoryLabel(festival.category);

  const togglePlanItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const clearPlan = () => setSelectedItemIds(new Set());

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]">
        <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
          {heroImage ? (
            <>
              <Image src={heroImage} alt={festival.title} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#ece8df] text-black/45">
              <span className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
                Няма основна снимка
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/85">
              {festival.city && citySlug ? (
                <Link href={`/city/${citySlug}`} className="rounded-full bg-white/15 px-3 py-1 transition hover:bg-white/25">
                  {festival.city}
                </Link>
              ) : (
                <span className="rounded-full bg-white/15 px-3 py-1">Град: —</span>
              )}
              <span className="rounded-full bg-white/15 px-3 py-1">{dateText}</span>
              {categoryText ? <span className="rounded-full bg-white/15 px-3 py-1">{categoryText}</span> : null}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{festival.title}</h1>
            <div className="mt-4 flex flex-wrap gap-3">
              {primaryCta ? (
                <a
                  href={primaryCta.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#0c0e14] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {primaryCta.label}
                </a>
              ) : null}
              {secondaryCta ? (
                <a
                  href={secondaryCta.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/35 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {secondaryCta.label}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-7">
          <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
            <h2 className="text-xl font-semibold text-[#0c0e14]">Описание</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-black/65">
              {festival.description?.trim() || "Описанието още не е публикувано."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {festival.is_free ? <Badge variant="primary">Безплатен вход</Badge> : <Badge variant="neutral">Платен вход</Badge>}
              {festival.price_range ? <Badge variant="neutral">{festival.price_range}</Badge> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
            <h2 className="text-xl font-semibold text-[#0c0e14]">Галерия</h2>
            {imageMedia.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {imageMedia.slice(0, 8).map((item) => (
                  <figure key={item.id} className="overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.03]">
                    <div className="relative h-44">
                      <Image src={item.url} alt={item.caption ?? festival.title} fill className="object-cover" />
                    </div>
                    {item.caption ? <figcaption className="px-3 py-2 text-xs text-black/55">{item.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-black/[0.14] bg-[#f5f4f0] px-4 py-6 text-sm text-black/50">
                Галерията още не е публикувана.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]">
            <h2 className="text-xl font-semibold text-[#0c0e14]">Програма</h2>
            {!groupedDays.length ? (
              <div className="mt-4 rounded-xl border border-dashed border-black/[0.14] bg-[#f5f4f0] px-4 py-6 text-sm text-black/50">
                Програмата още не е публикувана.
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {groupedDays.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDayId(day.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                        displayedDay?.id === day.id
                          ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                          : "border-black/[0.1] bg-white text-[#0c0e14] hover:border-black/20 hover:bg-black/[0.03]"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {(displayedDay?.items ?? []).length ? (
                    displayedDay?.items.map((item) => {
                      const itemId = String(item.id);
                      const selected = selectedItemIds.has(itemId);
                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-black/[0.08] bg-white p-4 shadow-[0_2px_0_rgba(12,14,20,0.03),0_6px_14px_rgba(12,14,20,0.06)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                                {formatTimeRange(item.start_time, item.end_time)}
                                {item.stage ? ` • ${item.stage}` : ""}
                              </p>
                              <h3 className="text-base font-semibold text-[#0c0e14]">{item.title}</h3>
                              {item.description ? <p className="text-sm text-black/60">{item.description}</p> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePlanItem(itemId)}
                              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                                selected
                                  ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#1d202b]"
                                  : "border-black/[0.1] bg-white text-[#0c0e14] hover:border-black/20 hover:bg-black/[0.03]"
                              }`}
                            >
                              {selected ? "Премахни" : "Добави"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-black/[0.14] bg-[#f5f4f0] px-4 py-6 text-sm text-black/50">
                      Няма публикувани точки за избрания ден.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {relatedFestivals.length ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#0c0e14]">Още фестивали в {festival.city}</h2>
                <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#0c0e14]">
                  {citySlug ? <Link href={`/city/${citySlug}`}>Страница на града</Link> : null}
                  {calendarMonth ? <Link href={`/calendar/${calendarMonth}`}>Календар за месеца</Link> : null}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {relatedFestivals.slice(0, 4).map((item) => (
                  <Link key={item.slug} href={`/festival/${item.slug}`} className="block">
                    <EventCard
                      title={item.title}
                      city={item.city}
                      category={item.category}
                      imageUrl={item.image_url}
                      startDate={item.start_date}
                      endDate={item.end_date}
                      isFree={item.is_free}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[90px]">
          <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
            <h2 className="text-lg font-semibold text-[#0c0e14]">Къде и кога</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Дата</dt>
                <dd className="mt-1 text-black/70">{dateText}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Локация</dt>
                <dd className="mt-1 text-black/70">{venueText}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              {mapHref ? (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#0c0e14] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Навигация
                </a>
              ) : (
                <span className="rounded-xl border border-dashed border-black/[0.14] bg-[#f5f4f0] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                  Няма данни за навигация
                </span>
              )}
              {festival.ticket_url ? (
                <a
                  href={festival.ticket_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Билети
                </a>
              ) : festival.website_url ? (
                <a
                  href={festival.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  Уебсайт
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0c0e14]">Моят план</h2>
              {selectedItems.length ? (
                <button
                  type="button"
                  onClick={clearPlan}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 transition hover:text-black/70"
                >
                  Изчисти
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              {selectedItems.length ? (
                selectedItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-black/[0.08] bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
                      {formatTimeRange(item.start_time, item.end_time)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0c0e14]">{item.title}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-black/[0.14] bg-[#f5f4f0] px-4 py-5 text-sm text-black/50">
                  Добави точки от програмата, за да създадеш личен план.
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Напомняне</label>
              <Select
                value={reminder}
                onChange={(event) => setReminder(event.target.value as ReminderValue)}
                className="border-black/[0.12] bg-white/95 focus:ring-[#ff4c1f]/20"
              >
                <option value="none">Без напомняне</option>
                <option value="24h">24 часа по-рано</option>
                <option value="same_day_09">В деня на събитието в 09:00</option>
              </Select>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
