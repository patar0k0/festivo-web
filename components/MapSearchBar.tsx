"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ApplyParams = {
  city?: string;
  from?: string;
  to?: string;
  cat?: string;
  free?: boolean;
  sort?: string;
  month?: string;
};

function updateParam(params: URLSearchParams, key: string, value?: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export default function MapSearchBar({
  initialFilters,
}: {
  initialFilters?: {
    city?: string[];
    from?: string;
    to?: string;
    cat?: string[];
    free?: boolean;
    sort?: "soonest" | "curated" | "nearest";
    month?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [location, setLocation] = useState(initialFilters?.city?.[0] ?? "");
  const [from, setFrom] = useState(initialFilters?.from ?? "");
  const [to, setTo] = useState(initialFilters?.to ?? "");
  const [category, setCategory] = useState(initialFilters?.cat?.[0] ?? "");
  const [freeOnly, setFreeOnly] = useState(initialFilters?.free ?? true);

  const apply = (values: ApplyParams) => {
    const current = new URLSearchParams(searchParams.toString());
    const next = new URLSearchParams(searchParams.toString());

    updateParam(next, "city", values.city);
    updateParam(next, "from", values.from);
    updateParam(next, "to", values.to);
    updateParam(next, "cat", values.cat);
    updateParam(next, "free", values.free === undefined ? undefined : values.free ? "1" : "0");
    updateParam(next, "sort", values.sort);
    updateParam(next, "month", values.month);
    next.delete("page");

    current.delete("page");
    const currentComparable = current.toString();
    const nextComparable = next.toString();

    if (currentComparable === nextComparable) {
      router.refresh();
      return;
    }

    router.push(nextComparable ? `${pathname}?${nextComparable}` : pathname, { scroll: false });
  };

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-2xl border border-black/[0.08] bg-white/75 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_24px_rgba(12,14,20,0.07)] md:flex-row md:items-end">
      <div className="min-w-[12rem] flex-1">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Град</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          placeholder="София, Пловдив"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div className="min-w-[9rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">От</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </div>
      <div className="min-w-[9rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">До</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <div className="min-w-[10rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Категория</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          placeholder="folk, jazz"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 pt-4 text-sm text-muted md:pt-0">
        <input
          id="mapFreeOnly"
          type="checkbox"
          checked={freeOnly}
          onChange={(event) => setFreeOnly(event.target.checked)}
          className="h-4 w-4 rounded border-black/25 text-[#ff4c1f] focus:ring-[#ff4c1f]/30"
        />
        Само безплатни
      </label>
      <button
        type="button"
        onClick={() =>
          apply({
            city: location || undefined,
            from: from || undefined,
            to: to || undefined,
            cat: category || undefined,
            free: freeOnly,
            sort: initialFilters?.sort,
            month: initialFilters?.month,
          })
        }
        className="rounded-xl bg-[#0c0e14] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
      >
        Търси
      </button>
    </div>
  );
}
