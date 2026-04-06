"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS } from "@/lib/admin/adminNativeDateTimeClasses";

export type AdminDateTimeLocalInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string;
};

const AdminDateTimeLocalInput = forwardRef<HTMLInputElement, AdminDateTimeLocalInputProps>(function AdminDateTimeLocalInput(
  { className = "", ...rest },
  ref,
) {
  return (
    <input ref={ref} type="datetime-local" className={`${ADMIN_NATIVE_DATETIME_LOCAL_INPUT_CLASS} ${className}`.trim()} {...rest} />
  );
});

export default AdminDateTimeLocalInput;
