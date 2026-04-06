"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import AdminTimeInput from "@/components/admin/inputs/AdminTimeInput";
import { dbTimeToHmInput, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";
import {
  compareProgramEditorRows,
  compactProgramDraft,
  emptyProgramDraft,
  programDraftFromEditorRows,
  programDraftToEditorRows,
  type ProgramDraft,
  type ProgramEditorRow,
} from "@/lib/festival/programDraft";
import { ADMIN_ENTITY_CONTROL_CLASS } from "@/components/admin/entity";

function newRow(partial?: Partial<ProgramEditorRow>): ProgramEditorRow {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    date: "",
    dayTitle: null,
    title: "",
    start_time: null,
    end_time: null,
    stage: null,
    description: null,
    ...partial,
  };
}

function serializeDraft(d: ProgramDraft): string {
  return JSON.stringify(compactProgramDraft(d));
}

function isValidIsoDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const d = new Date(`${s.trim()}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function isFirstRowForDate(row: ProgramEditorRow, sorted: ProgramEditorRow[]): boolean {
  const i = sorted.findIndex((r) => r.id === row.id);
  if (i <= 0) return true;
  return sorted[i - 1]!.date !== row.date;
}

type Props = {
  value: ProgramDraft | null | undefined;
  onChange: (next: ProgramDraft) => void;
  /** Shown on empty day date field */
  datePlaceholder?: string;
};

export default function ProgramDraftEditor({ value, onChange, datePlaceholder = "Дата" }: Props) {
  const baseDraft = value && value.days ? value : emptyProgramDraft();
  const [rows, setRows] = useState<ProgramEditorRow[]>(() => programDraftToEditorRows(baseDraft));
  const lastEmittedRef = useRef<string>(serializeDraft(baseDraft));

  useEffect(() => {
    const incoming = serializeDraft(value ?? emptyProgramDraft());
    if (incoming === lastEmittedRef.current) return;
    lastEmittedRef.current = incoming;
    setRows(programDraftToEditorRows(value ?? emptyProgramDraft()));
  }, [value]);

  const emit = useCallback(
    (next: ProgramEditorRow[]) => {
      setRows(next);
      const built = programDraftFromEditorRows(next);
      lastEmittedRef.current = serializeDraft(built);
      onChange(built);
    },
    [onChange],
  );

  const sortedRows = useMemo(() => [...rows].sort(compareProgramEditorRows), [rows]);

  const uniqueValidDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const d = r.date.trim();
      if (d && isValidIsoDateString(d)) set.add(d);
    }
    return set.size;
  }, [rows]);

  const allRowsShareSameDateString =
    rows.length > 0 && new Set(rows.map((r) => r.date.trim())).size === 1 && Boolean(rows[0]!.date.trim());

  const sharedDateValue = allRowsShareSameDateString ? rows[0]!.date.trim() : "";

  const showCompactDateChrome = allRowsShareSameDateString && rows.length > 0;

  const showOptionalDaySubtitle = uniqueValidDates > 1;

  const updateRow = (id: string, partial: Partial<ProgramEditorRow>) => {
    emit(rows.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const setSharedDate = (iso: string) => {
    emit(rows.map((r) => ({ ...r, date: iso })));
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    const dateHint = last?.date?.trim() ?? "";
    emit([...rows, newRow({ date: dateHint })]);
  };

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    emit(next.length ? next : []);
  };

  if (!rows.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-black/60">
          Няма записани събития в разписанието. Добавете редове с час, заглавие и по избор сцена или описание.
        </p>
        <button
          type="button"
          onClick={() => emit([newRow()])}
          className="rounded-lg border border-[#18a05e]/40 bg-[#18a05e]/10 px-4 py-2 text-sm font-semibold text-[#0e7a45]"
        >
          + Добави ред
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-black/60">
          Разписание по часове. Всяко събитие е отделен ред; при няколко календарни дни групите се подреждат по дата.
        </p>
        <button
          type="button"
          onClick={addRow}
          className="shrink-0 rounded-lg border border-[#18a05e]/40 bg-[#18a05e]/10 px-4 py-2 text-sm font-semibold text-[#0e7a45]"
        >
          + Добави ред
        </button>
      </div>

      {showCompactDateChrome ? (
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Дата на програмата</span>
            <DdMmYyyyDateInput
              value={sharedDateValue}
              onChange={setSharedDate}
              className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1.5 max-w-[12rem]`}
              placeholder={datePlaceholder}
            />
          </label>
          <p className="mt-1.5 text-xs text-black/45">Еднодневен фестивал: една дата за всички редове по-долу.</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {sortedRows.map((row) => {
          const showDateField = !showCompactDateChrome;
          const showDayTitleField = showOptionalDaySubtitle && isFirstRowForDate(row, sortedRows) && row.date.trim() && isValidIsoDateString(row.date.trim());

          return (
            <li key={row.id} className="rounded-xl border border-black/[0.08] bg-white/90 p-3 shadow-sm shadow-black/[0.02]">
              {showDayTitleField ? (
                <label className="mb-2 block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">
                    Подзаглавие за деня (по избор)
                  </span>
                  <input
                    type="text"
                    value={row.dayTitle ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      updateRow(row.id, { dayTitle: v });
                    }}
                    className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 text-sm text-black/70 placeholder:text-black/35`}
                    placeholder="напр. Ден на рока"
                  />
                </label>
              ) : null}

              <div className="grid gap-2.5 md:grid-cols-12 md:items-start">
                {showDateField ? (
                  <label className="md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">{datePlaceholder}</span>
                    <DdMmYyyyDateInput
                      value={row.date}
                      onChange={(iso) => updateRow(row.id, { date: iso })}
                      className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1`}
                      placeholder={datePlaceholder}
                    />
                  </label>
                ) : null}

                <label className={showDateField ? "md:col-span-2" : "md:col-span-2"}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Начало</span>
                  <AdminTimeInput
                    step={60}
                    value={dbTimeToHmInput(row.start_time)}
                    onChange={(e) => updateRow(row.id, { start_time: parseHmInputToDbTime(e.target.value) })}
                    className="mt-1"
                    aria-label="Начало"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">Край (по избор)</span>
                  <AdminTimeInput
                    step={60}
                    value={dbTimeToHmInput(row.end_time)}
                    onChange={(e) => updateRow(row.id, { end_time: parseHmInputToDbTime(e.target.value) })}
                    className="mt-1"
                    aria-label="Край"
                  />
                </label>

                <label className="md:col-span-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/55">Събитие</span>
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => updateRow(row.id, { title: e.target.value })}
                    className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 font-medium`}
                    placeholder="Заглавие на събитието"
                  />
                </label>

                <div className="flex items-end justify-end md:col-span-2">
                  <button type="button" onClick={() => removeRow(row.id)} className="text-xs font-semibold text-[#b13a1a]">
                    Премахни реда
                  </button>
                </div>

                <label className="md:col-span-8">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">Описание (по избор)</span>
                  <textarea
                    value={row.description ?? ""}
                    onChange={(e) => updateRow(row.id, { description: e.target.value || null })}
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
                    onChange={(e) => updateRow(row.id, { stage: e.target.value || null })}
                    className={`${ADMIN_ENTITY_CONTROL_CLASS} mt-1 text-sm text-black/70`}
                    placeholder="Главна сцена…"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
