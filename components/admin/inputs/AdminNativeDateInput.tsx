"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_DATE_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";

export type AdminNativeDateInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
};

const AdminNativeDateInput = forwardRef<HTMLInputElement, AdminNativeDateInputProps>(function AdminNativeDateInput(
  { className = "", ...rest },
  ref,
) {
  return <input ref={ref} type="date" className={`${ADMIN_NATIVE_DATE_INPUT_CLASS} ${className}`.trim()} {...rest} />;
});

export default AdminNativeDateInput;
