"use client";

import { useCallback, useMemo } from "react";
import {
  emptyProgramDraft,
  parseProgramDraftUnknown,
  type ProgramDraft,
  type ProgramDraftDay,
  type ProgramDraftItem,
} from "@/lib/festival/programDraft";

type Props = {
  value: ProgramDraft | null | undefined;
  onChange: (next: ProgramDraft) => void;
  /** Pre-fill date for the first added day (festival start_date from wizard). */
  defaultDate?: string;
};

// ── Editor-only working type (with stable client ids for React keys) ─────
// We don't add ids on the canonical ProgramDraft (server validates by shape),
// just keep map of (dayIndex, itemIndex) — simple enough at this scale.
type EditorItem = ProgramDraftItem;
type EditorDay = ProgramDraftDay;

const FIELD_CLASS =
  "w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-[#7c2d12]/25";

const LABEL_CLASS = "block text-xs font-medium text-[#0c0e14] mb-1";

function blankItem(): EditorItem {
  return { title: "", start_time: null, end_time: null, stage: null, description: null };
}

function blankDay(date: string): EditorDay {
  return { date, title: null, items: [blankItem()] };
}

/** Hydrate from possibly-malformed input; never throws. */
function hydrateDraft(value: ProgramDraft | null | undefined): EditorDay[] {
  if (!value) return [];
  const parsed = parseProgramDraftUnknown(value);
  if (!parsed.ok) return [];
  // Hydrate empty items so the editor never shows an empty day card.
  return parsed.value.days.map((d) => ({
    date: d.date,
    title: d.title ?? null,
    items: d.items.length > 0 ? d.items.slice() : [blankItem()],
  }));
}

export default function OrganizerProgramEditor({ value, onChange, defaultDate }: Props) {
  const days = useMemo(() => hydrateDraft(value), [value]);

  const emit = useCallback(
    (next: EditorDay[]) => {
      const draft: ProgramDraft = {
        ...emptyProgramDraft(),
        days: next,
      };
      onChange(draft);
    },
    [onChange],
  );

  const addDay = () => {
    const seed =
      defaultDate?.trim() ||
      (days.length > 0 ? days[days.length - 1].date : "") ||
      "";
    emit([...days, blankDay(seed)]);
  };

  const removeDay = (di: number) => {
    emit(days.filter((_, i) => i !== di));
  };

  const patchDay = (di: number, patch: Partial<EditorDay>) => {
    emit(days.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  };

  const addItem = (di: number) => {
    emit(
      days.map((d, i) =>
        i === di ? { ...d, items: [...d.items, blankItem()] } : d,
      ),
    );
  };

  const removeItem = (di: number, ii: number) => {
    emit(
      days.map((d, i) =>
        i === di ? { ...d, items: d.items.filter((_, k) => k !== ii) } : d,
      ),
    );
  };

  const patchItem = (di: number, ii: number, patch: Partial<EditorItem>) => {
    emit(
      days.map((d, i) =>
        i === di
          ? {
              ...d,
              items: d.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)),
            }
          : d,
      ),
    );
  };

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300/55 bg-[#fefcf8] px-5 py-8 text-center">
        <p className="text-3xl" aria-hidden="true">📅</p>
        <p className="mt-2 text-sm font-semibold text-[#0c0e14]">
          Все още няма програма
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-black/55">
          Добави поне един ден с събития, за да могат посетителите да си запазват
          конкретни часове в плана.
        </p>
        <button
          type="button"
          onClick={addDay}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c200d]"
        >
          + Добави първи ден
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {days.map((day, di) => (
        <div
          key={di}
          className="rounded-xl border border-amber-200/55 bg-white/95 p-4 shadow-sm ring-1 ring-amber-100/30 md:p-5"
        >
          {/* Day header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`day-date-${di}`} className={LABEL_CLASS}>
                  Дата на деня <span className="text-[#7c2d12]">*</span>
                </label>
                <input
                  id={`day-date-${di}`}
                  type="date"
                  value={day.date}
                  onChange={(ev) => patchDay(di, { date: ev.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor={`day-title-${di}`} className={LABEL_CLASS}>
                  Тема на деня (по избор)
                </label>
                <input
                  id={`day-title-${di}`}
                  type="text"
                  value={day.title ?? ""}
                  onChange={(ev) => patchDay(di, { title: ev.target.value || null })}
                  placeholder="напр. Откриване / Главен ден"
                  className={FIELD_CLASS}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeDay(di)}
              className="shrink-0 rounded-lg border border-red-200/70 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50/80"
              aria-label={`Премахни ден ${di + 1}`}
            >
              🗑 Премахни деня
            </button>
          </div>

          {/* Items */}
          <div className="mt-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">
              Събития през деня
            </p>

            {day.items.map((item, ii) => (
              <div
                key={ii}
                className="rounded-lg border border-black/[0.06] bg-[#fafaf8] p-3 md:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[11px] font-medium text-black/45">
                    Събитие {ii + 1}
                  </p>
                  {day.items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(di, ii)}
                      className="text-xs font-medium text-red-700 underline decoration-red-300/40 underline-offset-2 hover:decoration-red-500/60"
                      aria-label={`Премахни събитие ${ii + 1}`}
                    >
                      Премахни
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 space-y-3">
                  <div>
                    <label htmlFor={`item-title-${di}-${ii}`} className={LABEL_CLASS}>
                      Заглавие <span className="text-[#7c2d12]">*</span>
                    </label>
                    <input
                      id={`item-title-${di}-${ii}`}
                      type="text"
                      value={item.title}
                      onChange={(ev) => patchItem(di, ii, { title: ev.target.value })}
                      placeholder="напр. Откриваща церемония, концерт на 'X'"
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`item-start-${di}-${ii}`} className={LABEL_CLASS}>
                        Начало (час)
                      </label>
                      <input
                        id={`item-start-${di}-${ii}`}
                        type="time"
                        step={60}
                        value={item.start_time ?? ""}
                        onChange={(ev) =>
                          patchItem(di, ii, { start_time: ev.target.value || null })
                        }
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor={`item-end-${di}-${ii}`} className={LABEL_CLASS}>
                        Край (час)
                      </label>
                      <input
                        id={`item-end-${di}-${ii}`}
                        type="time"
                        step={60}
                        value={item.end_time ?? ""}
                        onChange={(ev) =>
                          patchItem(di, ii, { end_time: ev.target.value || null })
                        }
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`item-stage-${di}-${ii}`} className={LABEL_CLASS}>
                      Сцена / място (по избор)
                    </label>
                    <input
                      id={`item-stage-${di}-${ii}`}
                      type="text"
                      value={item.stage ?? ""}
                      onChange={(ev) =>
                        patchItem(di, ii, { stage: ev.target.value || null })
                      }
                      placeholder="напр. Главна сцена / Зала 1"
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`item-description-${di}-${ii}`}
                      className={LABEL_CLASS}
                    >
                      Описание (по избор)
                    </label>
                    <textarea
                      id={`item-description-${di}-${ii}`}
                      value={item.description ?? ""}
                      onChange={(ev) =>
                        patchItem(di, ii, { description: ev.target.value || null })
                      }
                      rows={2}
                      placeholder="Кратко описание на събитието"
                      className={`${FIELD_CLASS} min-h-[3.5rem] resize-y`}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addItem(di)}
              className="w-full rounded-lg border border-dashed border-amber-300/60 bg-amber-50/30 px-3 py-2 text-xs font-semibold text-[#7c2d12] transition hover:bg-amber-50/60"
            >
              + Добави събитие в този ден
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addDay}
        className="w-full rounded-xl border-2 border-dashed border-amber-300/60 bg-white/60 px-3 py-3 text-sm font-semibold text-[#7c2d12] transition hover:bg-amber-50/40"
      >
        + Добави още един ден
      </button>
    </div>
  );
}
