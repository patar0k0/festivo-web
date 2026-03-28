import Link from "next/link";
import Container from "@/components/ui/Container";
import EventCard from "@/components/ui/EventCard";
import Section from "@/components/ui/Section";
import { cityHref } from "@/lib/cities";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import type { HomePageViewProps } from "@/lib/home/loadHomePageData";
import { Festival } from "@/lib/types";
import CitySelectClient from "./CitySelectClient";
import NearMeCtaClient from "./NearMeCtaClient";
import QuickChipsClient from "./QuickChipsClient";

/**
 * Визуален песочник за `/test`: същите данни като `RealHomePage` (`loadHomePageData`),
 * но отделен компонент за експерименти без промяна на продукционния UI.
 */
function EventsSection({
  id,
  title,
  festivals,
}: {
  id?: string;
  title: string;
  festivals: Festival[];
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="rounded-[1.75rem] border border-white/[0.07] bg-slate-50/[0.97] p-6 text-[#0c0e14] shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-600/80">
              Каталог
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0c0e14] md:text-3xl">
              {title}
            </h2>
          </div>
          <Link
            href="/festivals"
            className="inline-flex w-fit shrink-0 items-center justify-center rounded-full border border-[#0c0e14]/10 bg-white px-5 py-2.5 text-xs font-semibold text-[#0c0e14] shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          >
            Виж всички
          </Link>
        </div>

        <div className="mt-6">
          {festivals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#0c0e14]/12 bg-white/60 px-6 py-12 text-center">
              <p className="text-sm text-black/55">Няма фестивали за тази секция.</p>
              <Link
                href="/festivals"
                className="mt-3 inline-block text-sm font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4 transition hover:text-violet-900"
              >
                Виж следващите събития →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
              {festivals.map((festival) => (
                <EventCard
                  key={festival.slug}
                  title={festival.title}
                  city={festivalCityLabel(festival)}
                  category={festival.category}
                  imageUrl={getFestivalHeroImage(festival)}
                  startDate={festival.start_date}
                  endDate={festival.end_date}
                  isFree={festival.is_free}
                  description={festival.description}
                  showDescription
                  showDetailsButton
                  detailsHref={`/festivals/${festival.slug}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function RealHomePageSandbox({
  nearestFestivals,
  weekendFestivals,
  homeCityOptions,
  selectedCityName,
  quickChipHrefs,
}: HomePageViewProps) {
  const footerCities = homeCityOptions.slice(0, 8);
  const chips = [
    { label: "Само безплатни", href: quickChipHrefs.free },
    { label: "Този уикенд", href: quickChipHrefs.weekend },
    { label: "Този месец", href: quickChipHrefs.month },
    ...quickChipHrefs.categoryChips,
  ];

  const secondaryCtaClass =
    "rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 shadow-sm backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35";

  const nearMeClass =
    "w-full rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-5 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_8px_32px_rgba(139,92,246,0.35)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50";

  return (
    <div
      className="test-sandbox-shell landing-bg relative overflow-x-hidden pb-28 text-slate-100 md:pb-0"
      data-home-sandbox
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-40 left-1/3 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <Section className="relative overflow-x-clip bg-transparent pb-12 pt-20 md:pb-16 md:pt-24">
        <Container>
          <div className="relative space-y-8 lg:space-y-10">
            <p
              className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-center text-[11px] leading-relaxed text-slate-400 backdrop-blur-md"
              role="status"
            >
              UI песочник (/test) — редактирай{" "}
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-200">
                components/home/RealHomePageSandbox.tsx
              </code>
              . Данните идват от същия код като началната страница (
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-200">
                loadHomePageData
              </code>
              ).
            </p>

            <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.11] to-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />

              <div className="relative max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-400/80" />
                  <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-violet-200/90">
                    Festivo · преглед
                  </p>
                </div>
                <h1 className="mt-4 text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-white md:text-4xl lg:text-[2.65rem]">
                  Открий безплатни фестивали в България
                </h1>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-300/90">
                  Бързо намери събития по град, дата и интерес — в един изчистен изглед.
                </p>
                <p className="mt-2 text-xs text-slate-500 md:text-sm">
                  Събития от организатори и проверени публични източници
                </p>
              </div>

              <div className="relative mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-stretch">
                <NearMeCtaClient className={nearMeClass} />
                {homeCityOptions.length ? (
                  <CitySelectClient
                    homePath="/test"
                    cities={homeCityOptions.map((city) => ({
                      name: city.name,
                      slug: city.slug,
                      filterValue: city.filterValue,
                    }))}
                  />
                ) : (
                  <Link href="/festivals" className={secondaryCtaClass}>
                    Избери град
                  </Link>
                )}
                <Link href="/calendar" className={secondaryCtaClass}>
                  Избери дата
                </Link>
              </div>

              <div className="sandbox-chip-wrap relative mt-2 [&>div]:!mt-6">
                <QuickChipsClient chips={chips} />
              </div>
            </section>

            {selectedCityName ? (
              <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-600/15 to-fuchsia-600/10 px-5 py-3.5 text-sm font-medium text-violet-100 shadow-lg shadow-violet-950/20 backdrop-blur-sm md:px-6">
                Показваме фестивали в <span className="font-semibold text-white">{selectedCityName}</span>
              </section>
            ) : null}

            <EventsSection id="nearest-festivals" title="Предстоящи" festivals={nearestFestivals} />
            <EventsSection title="Този уикенд" festivals={weekendFestivals} />

            <section
              id="home-cities"
              className="rounded-[1.75rem] border border-white/[0.07] bg-slate-50/[0.97] p-6 text-[#0c0e14] shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-xl md:p-8"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-600/80">
                Навигация
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Градове</h2>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {footerCities.length ? (
                  footerCities.map((city) => (
                    <Link
                      key={city.filterValue}
                      href={
                        city.slug
                          ? cityHref(city.slug)
                          : `/festivals?city=${encodeURIComponent(city.filterValue)}`
                      }
                      className="rounded-full border border-[#0c0e14]/8 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#0c0e14] shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                    >
                      {city.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-black/55">Все още няма налични градове.</p>
                )}
              </div>
            </section>
          </div>
        </Container>
      </Section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden">
        <NearMeCtaClient className={`block ${nearMeClass}`} />
      </div>
    </div>
  );
}
