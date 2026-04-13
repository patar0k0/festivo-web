"use client";

import { forwardRef, useEffect, useState, type ChangeEvent, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_DATE_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import {
  formatIsoYyyyMmDdToDdMmYyyyDots,
  formatTypingMaskEuropeanDots,
  parseFlexibleDateToIso,
} from "@/lib/dates/euDateFormat";

export type AdminNativeDateInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
};

/**
 * Text `ДД.ММ.ГГГГ` mask. For compatibility with former `type="date"` fields, `value` is `yyyy-MM-dd` or "".
 */
const AdminNativeDateInput = forwardRef<HTMLInputElement, AdminNativeDateInputProps>(function AdminNativeDateInput(
  { className = "", onChange, value, ...rest },
  ref,
) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) {
      setText("");
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setText(formatIsoYyyyMmDdToDdMmYyyyDots(v));
    } else {
      setText(v);
    }
  }, [value, focused]);

  const pushIso = (masked: string) => {
    const trimmed = masked.trim();
    if (!trimmed) {
      onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>);
      return;
    }
    const parsed = parseFlexibleDateToIso(trimmed);
    if (parsed === null) return;
    if (parsed === "") {
      onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>);
      return;
    }
    onChange?.({ target: { value: parsed } } as ChangeEvent<HTMLInputElement>);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="ДД.ММ.ГГГГ"
      className={`${ADMIN_NATIVE_DATE_INPUT_CLASS} ${className}`.trim()}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const trimmed = text.trim();
        if (!trimmed) {
          onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>);
          return;
        }
        const parsed = parseFlexibleDateToIso(trimmed);
        if (parsed === null) {
          const v = typeof value === "string" ? value.trim() : "";
          setText(v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatIsoYyyyMmDdToDdMmYyyyDots(v) : "");
          return;
        }
        if (parsed === "") onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>);
        else {
          onChange?.({ target: { value: parsed } } as ChangeEvent<HTMLInputElement>);
          setText(formatIsoYyyyMmDdToDdMmYyyyDots(parsed));
        }
      }}
      onChange={(e) => {
        const next = formatTypingMaskEuropeanDots(e.target.value);
        setText(next);
        pushIso(next);
      }}
      {...rest}
    />
  );
});

export default AdminNativeDateInput;
