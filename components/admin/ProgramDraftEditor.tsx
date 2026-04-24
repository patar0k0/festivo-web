"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import {
  isScheduleTimeOrderInvalid,
  parseHmInputToDbTime,
  sortByStartTime,
} from "@/lib/festival/festivalTimeFields";
import { ADMIN_NATIVE_TIME_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import {
  compactProgramDraft,
  emptyProgramDraft,
  programDraftFromEditorDayBlocks,
  programDraftToEditorDayBlocks,
  type ProgramDraft,
  type ProgramEditorDayBlock,
  type ProgramEditorItemRow,
} from "@/lib/festival/programDraft";
import { ADMIN_ENTITY_CONTROL_CLASS } from "@/components/admin/entity";

function safeTimeValue(value: string | null | undefined): string {
  if (!value) return "";

  // accept HH:mm or HH:mm:ss
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";

  return `${match[1]}:${match[2]}`;
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newItemRow(partial?: Partial<ProgramEditorItemRow>): ProgramEditorItemRow {
  return {
    id: newId(),
    title: "",
    start_time: null,
    end_time: null,
    stage: null,
    description: null,
    ...partial,
  };
}

function newDayBlock(partial?: Partial<Pick<ProgramEditorDayBlock, "date" | "dayTitle">>): ProgramEditorDayBlock {
  return {
    id: newId(),
    date: partial?.date ?? "",
    dayTitle: partial?.dayTitle ?? null,
    items: [newItemRow()],
  };
}

function serializeDraft(d: ProgramDraft): string {
  return JSON.stringify(compactProgramDraft(d));
}

type Props = {
  value: ProgramDraft | null | undefined;
  onChange: (next: ProgramDraft) => void;
  /** Shown on empty day date field */
  datePlaceholder?: string;
};

export default function ProgramDraftEditor({ value, onChange, datePlaceholder = "Дата" }: Props) {
  const baseDraft = value && value.days ? value : emptyProgramDraft();
  const [blocks, setBlocks] = useState<ProgramEditorDayBlock[]>(() => programDraftToEditorDayBlocks(baseDraft));
  const lastEmittedRef = useRef<string>(serializeDraft(baseDraft));
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    const incoming = serializeDraft(value ?? emptyProgramDraft());
    if (incoming === lastEmittedRef.current) return;
    lastEmittedRef.current = incoming;
    setBlocks(programDraftToEditorDayBlocks(value ?? emptyProgramDraft()));
  }, [value]);

  const applyBlocks = useCallback(
    (next: ProgramEditorDayBlock[]) => {
      const ordered = next.map((b) => ({ ...b, items: sortByStartTime(b.items) }));
      const built = programDraftFromEditorDayBlocks(ordered);
      lastEmittedRef.current = serializeDraft(built);
      setBlocks(ordered);
      onChange(built);
    },
    [onChange],
  );

  const patchBlocks = useCallback(
    (fn: (prev: ProgramEditorDayBlock[]) => ProgramEditorDayBlock[]) => {
      applyBlocks(fn(blocksRef.current));
    },
    [applyBlocks],
  );

  const updateItem = (dayId: string, itemId: string, partial: Partial<ProgramEditorItemRow>) => {
    patchBlocks((prev) =>
      prev.map((b) =>
        b.id !== dayId
          ? b
          : {
              ...b,
              items: b.items.map((it) => (it.id === itemId ? { ...it, ...partial } : it)),
            },
      ),
    );
  };

  const updateDay = (dayId: string, partial: Partial<Pick<ProgramEditorDayBlock, "date" | "dayTitle">>) => {
    patchBlocks((prev) => prev.map((b) => (b.id === dayId ? { ...b, ...partial } : b)));
  };

  const addDay = () => {
    patchBlocks((prev) => [...prev, newDayBlock()]);
  };

  const removeDay = (dayId: string) => {
    patchBlocks((prev) => {
      const next = prev.filter((b) => b.id !== dayId);
      return next.length ? next : [];
    });
  };

  const addRow = (dayId: string) => {
    patchBlocks((prev) => prev.map((b) => (b.id === dayId ? { ...b, items: [...b.items, newItemRow()] } : b)));
  };

  const removeRow = (dayId: string, itemId: string) => {
    patchBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== dayId) return b;
        const items = b.items.filter((it) => it.id !== itemId);
        return { ...b, items: items.length ? items : [newItemRow()] };
      }),
    );
  };

  if (!blocks.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-black/60">
          Няма дни в разписанието. Добавете ден и редове с час, заглавие и по избор сцена или описание.
        </p>
        <button
          type="button"
          onClick={() => applyBlocks([newDayBlock()])}
          className="rounded-lg border border-[#18a05e]/40 bg-[#18a05e]/10 px-4 py-2 text-sm font-semibold text-[#0e7a45]"
        >
          + Добави ден
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-black/60">
          Разписание по дни. Всеки ден има дата и редове с часове; събитията са подредени по начален час при запис.
        </p>
        <button
          type="button"
          onClick={addDay}
          className="shrink-0 rounded-lg border border-[#18a05e]/40 bg-[#18a05e]/10 px-4 py-2 text-sm font-semibold text-[#0e7a45]"
        >
          + Добави ден
        </button>
      </div>

      <ul className="space-y-4">
        {blocks.map((block) => (
          <li key={block.id} className="rounded-xl border border-black/[0.08] bg-white/90 p-3 shadow-sm shadow-black/[0.02]">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-black/[0.06] pb-3">
              <label className="min-w-[10rem] max-w-[14rem] flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">{datePlaceholder}</span>
                <DdMmYyyyDateInput
                  value={block.date}
                  onChange={(iso) => updateDay(block.id, { date: iso })}
                  className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1`}
                  placeholder={datePlaceholder}
                  visualVariant="dots"
                />
              </label>
              <button
                type="button"
                onClick={() => removeDay(block.id)}
                className="shrink-0 text-xs font-semibold text-[#b13a1a]"
              >
                Премахни ден
              </button>
            </div>

            <label className="mb-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">
                Подзаглавие за деня (по избор)
              </span>
              <input
                type="text"
                value={block.dayTitle ?? ""}
                onChange={(e) => updateDay(block.id, { dayTitle: e.target.value || null })}
                className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 text-sm text-black/70 placeholder:text-black/35`}
                placeholder="напр. Ден на рока"
              />
            </label>

            <ul className="space-y-3">
              {block.items.map((row) => {
                const orderInvalid = isScheduleTimeOrderInvalid(
                  parseHmInputToDbTime(row.start_time ?? "") ?? row.start_time,
                  parseHmInputToDbTime(row.end_time ?? "") ?? row.end_time,
                );

                return (
                  <li key={row.id} className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-2.5">
                    <div className="grid gap-2.5 md:grid-cols-12 md:items-start">
                      <div className="flex flex-wrap items-end gap-2 md:col-span-3">
                        <label className="w-[7rem] shrink-0">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Начало</span>
                          <input
                            type="time"
                            step={60}
                            value={safeTimeValue(row.start_time)}
                            onChange={(e) =>
                              updateItem(block.id, row.id, { start_time: e.target.value || null })
                            }
                            className={`${ADMIN_NATIVE_TIME_INPUT_CLASS} mt-1 !w-[7rem] shrink-0 tabular-nums`}
                            aria-label="Начало"
                          />
                        </label>
                        <label className="w-[7rem] shrink-0">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">Край</span>
                          <input
                            type="time"
                            step={60}
                            value={safeTimeValue(row.end_time)}
                            onChange={(e) =>
                              updateItem(block.id, row.id, { end_time: e.target.value || null })
                            }
                            className={`${ADMIN_NATIVE_TIME_INPUT_CLASS} mt-1 !w-[7rem] shrink-0 tabular-nums`}
                            aria-label="Край"
                          />
                        </label>
                        {orderInvalid ? (
                          <p className="w-full text-[11px] font-medium text-[#b13a1a] md:col-span-2">Краят трябва да е след началото.</p>
                        ) : null}
                      </div>

                      <label className="md:col-span-5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/55">Събитие</span>
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateItem(block.id, row.id, { title: e.target.value })}
                          className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 font-medium`}
                          placeholder="Заглавие на събитието"
                        />
                      </label>

                      <div className="flex items-end justify-end md:col-span-4">
                        <button
                          type="button"
                          onClick={() => removeRow(block.id, row.id)}
                          className="text-xs font-semibold text-[#b13a1a]"
                        >
                          Премахни реда
                        </button>
                      </div>

                      <label className="md:col-span-8">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">Описание (по избор)</span>
                        <textarea
                          value={row.description ?? ""}
                          onChange={(e) => updateItem(block.id, row.id, { description: e.target.value || null })}
                          rows={2}
                          className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 min-h-[52px]`}
                          placeholder="Кратко уточнение"
                        />
                      </label>

                      <label className="md:col-span-4">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/35">Сцена (по избор)</span>
                        <input
                          type="text"
                          value={row.stage ?? ""}
                          onChange={(e) => updateItem(block.id, row.id, { stage: e.target.value || null })}
                          className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 text-sm text-black/70`}
                          placeholder="Главна сцена…"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => addRow(block.id)}
                className="text-xs font-semibold text-[#0e7a45] underline-offset-2 hover:underline"
              >
                + Добави ред
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
