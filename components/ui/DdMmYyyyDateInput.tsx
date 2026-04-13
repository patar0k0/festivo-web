"use client";

import { useEffect, useState } from "react";
import {
  formatDateValueAsDdMmYyyy,
  formatDateValueAsDdMmYyyyDots,
  formatTypingMaskEuropeanDots,
  parseFlexibleDateToIso,
} from "@/lib/dates/euDateFormat";

export type DdMmYyyyDateInputProps = {
  value: string;
  onChange: (isoYyyyMmDd: string) => void;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Admin: dotted mask + `ДД.ММ.ГГГГ` display; public UI keeps slash-oriented typing. */
  visualVariant?: "slash" | "dots";
};

export default function DdMmYyyyDateInput({
  value,
  onChange,
  className,
  id,
  name,
  disabled,
  placeholder,
  visualVariant = "slash",
}: DdMmYyyyDateInputProps) {
  const resolvedPlaceholder = placeholder ?? (visualVariant === "dots" ? "ДД.ММ.ГГГГ" : "dd/mm/yyyy");

  const toDisplay = (v: string) =>
    visualVariant === "dots" ? formatDateValueAsDdMmYyyyDots(v) : formatDateValueAsDdMmYyyy(v);

  const [text, setText] = useState(() => toDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(toDisplay(value));
    }
  }, [value, focused, visualVariant]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const iso = parseFlexibleDateToIso(trimmed);
    if (iso === null) {
      setText(toDisplay(value));
      return;
    }
    if (iso === "") {
      onChange("");
      return;
    }
    onChange(iso);
    setText(toDisplay(iso));
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const next = visualVariant === "dots" ? formatTypingMaskEuropeanDots(raw) : raw;
        setText(next);
        const trimmed = next.trim();
        if (!trimmed) {
          onChange("");
          return;
        }
        const iso = parseFlexibleDateToIso(trimmed);
        if (iso === "") {
          onChange("");
          return;
        }
        if (iso !== null) {
          onChange(iso);
        }
      }}
    />
  );
}
