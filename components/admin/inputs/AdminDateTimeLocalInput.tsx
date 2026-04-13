"use client";

import { forwardRef, useEffect, useState, type ChangeEvent, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import {
  formatDate,
  formatTime,
  isValidTime,
  joinLocalDatetime,
  normalizeTime,
  splitDatetimeLocalValue,
} from "@/lib/admin/adminDateTimeTextFormat";
import { cn } from "@/lib/utils";

export type AdminDateTimeLocalInputProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "value" | "onChange"> & {
  className?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

const AdminDateTimeLocalInput = forwardRef<HTMLInputElement, AdminDateTimeLocalInputProps>(
  function AdminDateTimeLocalInput({ className = "", value = "", onChange, id, disabled }, ref) {
    const [dateText, setDateText] = useState(() => splitDatetimeLocalValue(value).date);
    const [timeText, setTimeText] = useState(() => splitDatetimeLocalValue(value).time);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
      if (focused) return;
      const { date, time } = splitDatetimeLocalValue(value);
      setDateText(date);
      setTimeText(time);
    }, [value, focused]);

    const pushEmpty = () => onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>);

    const pushJoined = (d: string, t: string) => {
      const joined = joinLocalDatetime(d, t);
      if (!d.trim() && !t.trim()) {
        pushEmpty();
        return;
      }
      if (joined) onChange?.({ target: { value: joined } } as ChangeEvent<HTMLInputElement>);
    };

    const dateId = id ? `${id}-date` : undefined;
    const timeId = id ? `${id}-time` : undefined;
    const timeInvalid = timeText.length > 0 && !isValidTime(timeText);

    return (
      <div className={`flex flex-wrap items-end gap-2 ${className}`.trim()}>
        <label className="min-w-[9.5rem] flex-1" htmlFor={dateId}>
          <span className="sr-only">Дата</span>
          <input
            ref={ref}
            id={dateId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="ДД.ММ.ГГГГ"
            disabled={disabled}
            className={cn(ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS, "mt-0")}
            value={dateText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              pushJoined(dateText, timeText);
            }}
            onChange={(e) => {
              const next = formatDate(e.target.value);
              setDateText(next);
              const j = joinLocalDatetime(next, timeText);
              if (j) onChange?.({ target: { value: j } } as ChangeEvent<HTMLInputElement>);
              else if (!next.trim() && !timeText.trim()) pushEmpty();
            }}
          />
        </label>
        <label className="w-[6.5rem] shrink-0" htmlFor={timeId}>
          <span className="sr-only">Час</span>
          <input
            id={timeId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="HH:mm"
            pattern="[0-9]{2}:[0-9]{2}"
            disabled={disabled}
            aria-invalid={timeInvalid ? true : undefined}
            className={cn(
              ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS,
              "mt-0 tabular-nums",
              timeInvalid && "border-red-500 bg-red-50",
            )}
            value={timeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              const normalized = normalizeTime(timeText);
              if (normalized !== timeText) {
                setTimeText(normalized);
                pushJoined(dateText, normalized);
              } else {
                pushJoined(dateText, timeText);
              }
            }}
            onChange={(e) => {
              const next = formatTime(e.target.value);
              setTimeText(next);
              const j = joinLocalDatetime(dateText, next);
              if (j) onChange?.({ target: { value: j } } as ChangeEvent<HTMLInputElement>);
              else if (!dateText.trim() && !next.trim()) pushEmpty();
            }}
          />
        </label>
      </div>
    );
  },
);

export default AdminDateTimeLocalInput;
