"use client";

import { useState } from "react";

export default function CopyUserIdButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded border border-black/[0.12] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] hover:bg-black/[0.04]"
      onClick={() => {
        void navigator.clipboard.writeText(id).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
    >
      {done ? "Копирано" : "Копирай ID"}
    </button>
  );
}
