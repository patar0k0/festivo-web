"use client";

import { useEffect, useState } from "react";
import { formatDateValueAsDdMmYyyy, parseFlexibleDateToIso } from "@/lib/dates/euDateFormat";

export type DdMmYyyyDateInputProps = {
  value: string;
  onChange: (isoYyyyMmDd: string) => void;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
};

export default function DdMmYyyyDateInput({
  value,
  onChange,
  className,
  id,
  name,
  disabled,
  placeholder = "dd/mm/yyyy",
}: DdMmYyyyDateInputProps) {
  const [text, setText] = useState(() => formatDateValueAsDdMmYyyy(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatDateValueAsDdMmYyyy(value));
    }
  }, [value, focused]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const iso = parseFlexibleDateToIso(trimmed);
    if (iso === null) {
      setText(formatDateValueAsDdMmYyyy(value));
      return;
    }
    if (iso === "") {
      onChange("");
      return;
    }
    onChange(iso);
    setText(formatDateValueAsDdMmYyyy(iso));
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onChange={(e) => {
        const next = e.target.value;
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
