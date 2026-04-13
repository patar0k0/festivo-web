"use client";

import { forwardRef, type ChangeEvent, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_TIME_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";
import { formatTime, isValidTime } from "@/lib/admin/adminDateTimeTextFormat";

export type AdminTimeInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
  /** Ignored — native time step is not used for text inputs. */
  step?: number;
};

const AdminTimeInput = forwardRef<HTMLInputElement, AdminTimeInputProps>(function AdminTimeInput(
  { className = "", onChange, value, step: _step, ...rest },
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
      className={`${ADMIN_NATIVE_TIME_INPUT_CLASS} ${className}`.trim()}
      value={value}
      onChange={handleChange}
    />
  );
});

export default AdminTimeInput;
