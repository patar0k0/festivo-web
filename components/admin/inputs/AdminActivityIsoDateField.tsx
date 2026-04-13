"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import AdminNativeDateInput from "@/components/admin/inputs/AdminNativeDateInput";

/**
 * GET filter field: visible DD.MM.ГГГГ + hidden `yyyy-MM-dd` for query params.
 */
export default function AdminActivityIsoDateField({
  name,
  defaultIso,
  className = "",
}: {
  name: string;
  defaultIso: string;
  className?: string;
}) {
  const [iso, setIso] = useState(defaultIso);

  useEffect(() => {
    setIso(defaultIso);
  }, [defaultIso]);

  return (
    <>
      <input type="hidden" name={name} value={iso} readOnly />
      <AdminNativeDateInput
        value={iso}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setIso(e.target.value)}
        className={className}
      />
    </>
  );
}
