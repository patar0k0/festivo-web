"use client";

import {
  forwardRef,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
} from "react";
import { ADMIN_NATIVE_TIME_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import { formatTime, isValidTime, normalizeTime } from "@/lib/admin/adminDateTimeTextFormat";
import { cn } from "@/lib/utils";

export type AdminTimeInputProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "step"> & {
  className?: string;
};

const AdminTimeInput = forwardRef<HTMLInputElement, AdminTimeInputProps>(function AdminTimeInput(
  { className = "", onChange, onBlur, value, ...rest },
  ref,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = formatTime(e.target.value);
    onChange?.({
      ...e,
      target: { ...e.target, value: next },
      currentTarget: { ...e.currentTarget, value: next },
    } as ChangeEvent<HTMLInputElement>);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = normalizeTime(raw);
    if (next !== raw) {
      onChange?.({
        ...e,
        target: { ...e.target, value: next },
        currentTarget: { ...e.currentTarget, value: next },
      } as ChangeEvent<HTMLInputElement>);
    }
    onBlur?.(e);
  };

  const showInvalid = typeof value === "string" && value.length > 0 && !isValidTime(value);

  return (
    <input
      ref={ref}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="HH:mm"
      pattern="[0-9]{2}:[0-9]{2}"
      aria-invalid={showInvalid || undefined}
      className={cn(ADMIN_NATIVE_TIME_INPUT_CLASS, className, showInvalid && "border-red-500 bg-red-50")}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});

export default AdminTimeInput;
