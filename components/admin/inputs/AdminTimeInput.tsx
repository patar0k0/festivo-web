"use client";

import {
  forwardRef,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { ADMIN_NATIVE_TIME_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import { isValidTime } from "@/lib/admin/adminDateTimeTextFormat";
import { cn } from "@/lib/utils";

export type AdminTimeInputProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "step"> & {
  className?: string;
};

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2);
}

const HH_MM_VALID = /^([01]\d|2[0-3]):([0-5]\d)$/;

function emitValue(
  next: string,
  base: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>,
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void,
) {
  onChange?.({
    ...base,
    target: { ...base.target, value: next },
    currentTarget: { ...base.currentTarget, value: next },
  } as ChangeEvent<HTMLInputElement>);
}

function inputValueToString(value: AdminTimeInputProps["value"]): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return value.join("");
}

const AdminTimeInput = forwardRef<HTMLInputElement, AdminTimeInputProps>(function AdminTimeInput(
  { className = "", onChange, onBlur, onKeyDown, value, ...rest },
  ref,
) {
  const stringValue = inputValueToString(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value);
    emitValue(formatted, e, onChange);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      onBlur?.(e);
      return;
    }

    let [h, m] = raw.split(":");

    h = h?.padStart(2, "0") || "00";
    m = m?.padEnd(2, "0") || "00";

    const normalized = `${h}:${m}`;

    if (HH_MM_VALID.test(normalized)) {
      if (normalized !== raw) {
        emitValue(normalized, e, onChange);
      }
    }

    onBlur?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();

      const parts = (stringValue || "00:00").split(":");
      const h = Number(parts[0]) || 0;
      const m = parts.length > 1 ? Number(parts[1]) || 0 : 0;
      const delta = e.key === "ArrowUp" ? 1 : -1;

      const newMinutes = (h * 60 + m + delta + 1440) % 1440;
      const newH = String(Math.floor(newMinutes / 60)).padStart(2, "0");
      const newM = String(newMinutes % 60).padStart(2, "0");

      emitValue(`${newH}:${newM}`, e, onChange);
      return;
    }

    onKeyDown?.(e);
  };

  const showInvalid = stringValue.length > 0 && !isValidTime(stringValue);

  return (
    <input
      ref={ref}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="HH:mm"
      aria-invalid={showInvalid || undefined}
      className={cn(ADMIN_NATIVE_TIME_INPUT_CLASS, className, showInvalid && "border-red-500 bg-red-50")}
      value={stringValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
});

export default AdminTimeInput;
