import { format } from "date-fns";
import { bg } from "date-fns/locale";
import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";
import { CardContent } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { pub } from "@/lib/public-ui/styles";
import { getFestivalTemporalState } from "@/lib/festival/temporal";

/** Кратко име на месец за оранжева значка (3–4 знака). */
const BADGE_MONTH_BG: Record<number, string> = {
  0: "ЯНУ",
  1: "ФЕВ",
  2: "МАРТ",
  3: "АПР",
  4: "МАЙ",
  5: "ЮНИ",
  6: "ЮЛИ",
  7: "АВГ",
  8: "СЕПТ",
  9: "ОКТ",
  10: "НОЕ",
  11: "ДЕК",
};

type EventCardProps = {
  title: string;
  city?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** When set, replaces the default start/end date line (e.g. multiple discrete days). */
  dateLine?: string | null;
  isFree?: boolean | null;
  isPromoted?: boolean | null;
  isVipOrganizer?: boolean | null;
  description?: string | null;
  showDetailsButton?: boolean;
  detailsHref?: string;
  showDescription?: boolean;
  showPlanControls?: boolean;
  festivalId?: string | number;
  /** When set with date fields, derives past/ongoing chip (Europe/Sofia). */
  occurrenceDates?: unknown;
  startTime?: string | null;
  endTime?: string | null;
};

function getDateBadge(date?: string | null) {
  if (!date) return { month: "TBA", day: "--" };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return { month: "TBA", day: "--" };
  const idx = parsed.getMonth();
  const month = BADGE_MONTH_BG[idx] ?? "—";
  return {
    month: month.toLocaleUpperCase("bg-BG"),
    day: format(parsed, "dd"),
  };
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Дата предстои";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Дата предстои";
  if (!end || end === start) {
    return format(startDate, "d MMMM yyyy", { locale: bg });
  }
  const endDate = new Date(end);
  return `${format(startDate, "d MMMM", { locale: bg })} - ${format(endDate, "d MMMM yyyy", { locale: bg })}`;
}

function getSignalTag(isFree?: boolean | null, startDate?: string | null) {
  if (isFree === true) return "Безплатно";
  if (!startDate) return null;

  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const day = parsed.getDay();
  if (day === 0 || day === 6) return "Уикенд";

  return null;
}

function getUrgencyTag(startDate?: string | null) {
  if (!startDate) return null;
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);

  const diffInDays = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffInDays === 0) return "Днес";
  if (diffInDays === 1) return "Утре";
  return null;
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

export default function EventCard({
  title,
  city,
  category,
  imageUrl,
  startDate,
  endDate,
  dateLine,
  isFree,
  isPromoted,
  isVipOrganizer,
  description,
  detailsHref,
  showDescription = false,
  showPlanControls = false,
  festivalId,
  occurrenceDates,
  startTime,
  endTime,
}: EventCardProps) {
  const badge = getDateBadge(startDate);
  const dateText = dateLine?.trim() ? dateLine : formatDateRange(startDate, endDate);
  const locationText = city || "Град: —";
  const snippet = description?.trim();
  const categoryText = categoryLabel(category);
  const signalTag = getSignalTag(isFree, startDate);
  const urgencyTag = getUrgencyTag(startDate);
  const temporalState = getFestivalTemporalState({
    start_date: startDate,
    end_date: endDate,
    occurrence_dates: occurrenceDates,
    start_time: startTime ?? null,
    end_time: endTime ?? null,
  });
  const temporalLabel = temporalState === "past" ? "Отминал" : temporalState === "ongoing" ? "Текущ" : null;

  return (
    <div
      className={cn(
        pub.festivalCard,
        "flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_2px_0_rgba(12,14,20,0.06),0_20px_42px_rgba(12,14,20,0.11)] focus-within:-translate-y-1 focus-within:shadow-[0_2px_0_rgba(12,14,20,0.06),0_20px_42px_rgba(12,14,20,0.11)]",
      )}
    >
      <div className="relative h-56 bg-black/[0.04]">
        {detailsHref ? (
          <Link
            href={detailsHref}
            aria-label={`Отвори фестивал ${title}`}
            className={cn(pub.festivalCardImageLink, pub.focusRing)}
          >
            {imageUrl ? (
              <FallbackImage
                src={imageUrl}
                alt={title}
                fill
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-300 ease-out group-hover/image:scale-105"
                resetKey={festivalId}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#f2efe9] text-sm text-black/45">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-13C4.67 20 4 19.33 4 18.5v-13Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path d="M8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="m4 17 4.5-4.5 3.5 3.5 4.5-4.5L20 15.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span>Няма снимка</span>
              </div>
            )}
          </Link>
        ) : imageUrl ? (
          <FallbackImage
            src={imageUrl}
            alt={title}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            resetKey={festivalId}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#f2efe9] text-sm text-black/45">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-13C4.67 20 4 19.33 4 18.5v-13Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.2" />
              <path d="m4 17 4.5-4.5 3.5 3.5 4.5-4.5L20 15.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>Няма снимка</span>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
          aria-hidden
        />

        <div className={pub.dateBadge}>
          <div className="text-[10px] font-semibold uppercase tracking-wide">{badge.month}</div>
          <div className="text-base font-bold leading-none">{badge.day}</div>
        </div>

        {categoryText ? <div className={pub.metaChip}>{categoryText}</div> : null}
      </div>

      <CardContent className="flex flex-1 flex-col p-5">
        <div className="space-y-2">
          <p className="text-sm text-black/55">
            {locationText} • {dateText}
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-[#0c0e14]">
            {detailsHref ? (
              <Link
                href={detailsHref}
                aria-label={`Отвори детайли за фестивал ${title}`}
                className={cn(
                  "transition-colors duration-200 hover:text-black/70 hover:underline",
                  pub.focusRing,
                  "focus-visible:ring-offset-2",
                )}
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {title}
              </Link>
            ) : (
              <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {title}
              </span>
            )}
          </h3>
        </div>

        {isPromoted || isVipOrganizer || urgencyTag || signalTag || temporalLabel ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isPromoted ? (
              <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-800">
                Промотирано
              </span>
            ) : null}
            {isVipOrganizer ? (
              <span className="rounded-full border border-violet-300/70 bg-violet-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-violet-800">
                VIP организатор
              </span>
            ) : null}
            {temporalLabel ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium tracking-[0.04em]",
                  temporalState === "past"
                    ? "border border-black/[0.06] bg-black/[0.025] text-black/45"
                    : "border border-black/[0.08] bg-black/[0.03] text-black/55",
                )}
              >
                {temporalLabel}
              </span>
            ) : null}
            {urgencyTag ? (
              <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                {urgencyTag}
              </span>
            ) : null}
            {signalTag ? (
              <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                {signalTag}
              </span>
            ) : null}
          </div>
        ) : null}

        {showDescription && snippet ? (
          <p
            className="mt-3 text-sm text-black/60"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {snippet}
          </p>
        ) : null}

        <div className="mt-auto pt-4">
          {showPlanControls && festivalId != null ? (
            <PlanFestivalBookmark
              festivalId={String(festivalId)}
              showProgrammeLink={false}
              showReminder={false}
            />
          ) : null}
        </div>
      </CardContent>
    </div>
  );
}
