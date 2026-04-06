"use client";

import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { ADMIN_ENTITY_CONTROL_CLASS } from "@/components/admin/entity";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export default function OccurrenceDaysEditor({ value, onChange, disabled }: Props) {
  const slots = value.length > 0 ? value : [""];

  const commitSlots = (nextSlots: string[]) => {
    onChange(nextSlots);
  };

  const setSlot = (index: number, iso: string) => {
    const next = [...slots];
    next[index] = iso;
    commitSlots(next);
  };

  const removeSlot = (index: number) => {
    commitSlots(slots.filter((_, i) => i !== index));
  };

  const addSlot = () => {
    const filled = slots.filter((s) => s.trim().length > 0);
    commitSlots([...filled, ""]);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-black/55">
        Отделни дни (напр. 11, 18 и 25). Ако списъкът е празен или всички полета са празни, важат само началната и крайната дата по-горе (непрекъснат период).
      </p>
      <div className="space-y-1.5">
        {slots.map((row, index) => (
          <div key={`${index}-${row}`} className="flex flex-wrap items-center gap-2">
            <DdMmYyyyDateInput
              value={row}
              onChange={(iso) => setSlot(index, iso)}
              disabled={disabled}
              className={`min-w-[9rem] flex-1 ${ADMIN_ENTITY_CONTROL_CLASS}`}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeSlot(index)}
              className="rounded-lg border border-black/[0.12] bg-white px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/70 disabled:opacity-45"
            >
              Премахни
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={addSlot}
        className="rounded-lg border border-[#18a05e]/35 bg-[#18a05e]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0e7a45] disabled:opacity-45"
      >
        + Добави ден
      </button>
    </div>
  );
}
