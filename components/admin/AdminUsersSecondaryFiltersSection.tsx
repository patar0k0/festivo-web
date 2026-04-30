"use client";

import { useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function AdminUsersSecondaryFiltersSection({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Допълнителни</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-800 shadow-sm hover:bg-gray-50"
        >
          {open ? "Скрий допълнителни" : "Покажи допълнителни"}
        </button>
      </div>
      {open ? children : null}
    </div>
  );
}
