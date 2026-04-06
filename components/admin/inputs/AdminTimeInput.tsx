"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_TIME_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";

export type AdminTimeInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
};

const AdminTimeInput = forwardRef<HTMLInputElement, AdminTimeInputProps>(function AdminTimeInput(
  { className = "", step = 60, ...rest },
  ref,
) {
  return <input ref={ref} type="time" step={step} className={`${ADMIN_NATIVE_TIME_INPUT_CLASS} ${className}`.trim()} {...rest} />;
});

export default AdminTimeInput;
