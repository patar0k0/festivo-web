"use client";

import { useCallback } from "react";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { dbTimeToHmInput, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";
import type { ProgramDraft, ProgramDraftDay, ProgramDraftItem } from "@/lib/festival/programDraft";
import { emptyProgramDraft } from "@/lib/festival/programDraft";
import { ADMIN_ENTITY_CONTROL_CLASS } from "@/components/admin/entity";

function cloneDraft(d: ProgramDraft): ProgramDraft {
  return {
    version: d.version,
    days: d.days.map((day) => ({
      date: day.date,
      title: day.title ?? null,
      items: day.items.map((it) => ({ ...it })),
    })),
  };
}

function newEmptyItem(): ProgramDraftItem {
  return {
    title: "",
    start_time: null,
    end_time: null,
    stage: null,
    description: null,
    sort_order: null,
  };
}

function newEmptyDay(): ProgramDraftDay {
  return { date: "", title: null, items: [newEmptyItem()] };
}

type Props = {
  value: ProgramDraft | null | undefined;
  onChange: (next: ProgramDraft) => void;
  /** Shown on empty day date field */
  datePlaceholder?: string;
};

export default function ProgramDraftEditor({ value, onChange, datePlaceholder = "Дата" }: Props) {
  const draft = value && value.days ? cloneDraft(value) : emptyProgramDraft();

  const pushDraft = useCallback(
    (next: ProgramDraft) => {
      onChange(cloneDraft(next));
    },
    [onChange],
  );

  const updateDay = (dayIndex: number, partial: Partial<ProgramDraftDay>) => {
    const next = cloneDraft(draft);
    next.days[dayIndex] = { ...next.days[dayIndex]!, ...partial };
    pushDraft(next);
  };

  const updateItem = (dayIndex: number, itemIndex: number, partial: Partial<ProgramDraftItem>) => {
    const next = cloneDraft(draft);
    const items = [...next.days[dayIndex]!.items];
    items[itemIndex] = { ...items[itemIndex]!, ...partial };
    next.days[dayIndex] = { ...next.days[dayIndex]!, items };
    pushDraft(next);
  };

  const addDay = () => {
    const next = cloneDraft(draft);
    next.days.push(newEmptyDay());
    pushDraft(next);
  };

  const removeDay = (dayIndex: number) => {
    const next = cloneDraft(draft);
    next.days.splice(dayIndex, 1);
    pushDraft(next);
  };

  const addItem = (dayIndex: number) => {
    const next = cloneDraft(draft);
    next.days[dayIndex] = {
      ...next.days[dayIndex]!,
      items: [...next.days[dayIndex]!.items, newEmptyItem()],
    };
    pushDraft(next);
  };

  const removeItem = (dayIndex: number, itemIndex: number) => {
    const next = cloneDraft(draft);
    const items = next.days[dayIndex]!.items.filter((_, i) => i !== itemIndex);
    next.days[dayIndex] = { ...next.days[dayIndex]!, items: items.length ? items : [newEmptyItem()] };
    pushDraft(next);
  };

  if (!draft.days.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-black/55">Няма дни в програмата.</p>
        <button type="button" onClick={() => pushDraft({ ...emptyProgramDraft(), days: [newEmptyDay()] })} className="text-sm font-semibold text-[#0e7a45]">
          + Добави ден
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {draft.days.map((day, di) => (
        <div key={`day-${di}`} className="rounded-xl border border-black/[0.08] bg-white/90 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="min-w-[140px] flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">{datePlaceholder}</span>
              <DdMmYyyyDateInput
                value={day.date}
                onChange={(iso) => updateDay(di, { date: iso })}
                className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1`}
              />
            </label>
            <label className="min-w-[180px] flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">Заглавие на деня (по избор)</span>
              <input
                type="text"
                value={day.title ?? ""}
                onChange={(e) => updateDay(di, { title: e.target.value || null })}
                className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1`}
                placeholder="напр. Ден 1"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => addItem(di)} className="text-xs font-semibold text-[#0e7a45]">
                + Точка
              </button>
              <button type="button" onClick={() => removeDay(di)} className="text-xs font-semibold text-[#b13a1a]">
                Премахни ден
              </button>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {day.items.map((item, ii) => (
              <li key={`item-${di}-${ii}`} className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-3">
                <div className="grid gap-2 md:grid-cols-12">
                  <label className="md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">От</span>
                    <input
                      type="time"
                      value={dbTimeToHmInput(item.start_time)}
                      onChange={(e) => updateItem(di, ii, { start_time: parseHmInputToDbTime(e.target.value) })}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-0.5`}
                    />
                  </label>
                  <label className="md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">До</span>
                    <input
                      type="time"
                      value={dbTimeToHmInput(item.end_time)}
                      onChange={(e) => updateItem(di, ii, { end_time: parseHmInputToDbTime(e.target.value) })}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-0.5`}
                    />
                  </label>
                  <label className="md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">Сцена</span>
                    <input
                      type="text"
                      value={item.stage ?? ""}
                      onChange={(e) => updateItem(di, ii, { stage: e.target.value || null })}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-0.5`}
                    />
                  </label>
                  <label className="md:col-span-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">Заглавие</span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(di, ii, { title: e.target.value })}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-0.5`}
                    />
                  </label>
                  <div className="flex items-end md:col-span-2">
                    <button type="button" onClick={() => removeItem(di, ii)} className="text-xs font-semibold text-[#b13a1a]">
                      Премахни
                    </button>
                  </div>
                  <label className="md:col-span-12">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">Описание</span>
                    <textarea
                      value={item.description ?? ""}
                      onChange={(e) => updateItem(di, ii, { description: e.target.value || null })}
                      rows={2}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-0.5 min-h-[52px]`}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" onClick={addDay} className="text-sm font-semibold text-[#0e7a45]">
        + Добави ден
      </button>
    </div>
  );
}
