"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";

const FIRST_VISIBLE = 5;

type FestivalsTagChipsClientProps = {
  categories: string[];
};

function buildChipHref(pathname: string, searchParams: URLSearchParams, category: string, active: boolean) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("page");

  if (active) {
    nextParams.delete("tag");
  } else {
    nextParams.set("tag", category);
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function FestivalsTagChipsClient({ categories }: FestivalsTagChipsClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");
  const [expanded, setExpanded] = useState(false);

  const { visibleCategories, showToggle } = useMemo(() => {
    const firstFive = categories.slice(0, FIRST_VISIBLE);
    const selected = activeTag && categories.includes(activeTag) ? activeTag : null;
    const needsSelected = selected !== null && !firstFive.includes(selected);
    const collapsed = needsSelected ? [...firstFive, selected] : firstFive;

    const hasHiddenCollapsed = categories.some((c) => !collapsed.includes(c));
    const show = expanded || hasHiddenCollapsed;

    return {
      visibleCategories: expanded ? categories : collapsed,
      showToggle: show,
    };
  }, [categories, activeTag, expanded]);

  const inactiveChipClass =
    "rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25";

  return (
    <>
      {visibleCategories.map((category) => {
        const active = activeTag === category;
        const href = buildChipHref(pathname, searchParams, category, active);

        return (
          <Link
            key={category}
            href={href}
            scroll={false}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
              active
                ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
            }`}
          >
            {labelForPublicCategory(category)}
          </Link>
        );
      })}
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={inactiveChipClass}
        >
          {expanded ? "По-малко ←" : "Още →"}
        </button>
      ) : null}
    </>
  );
}
