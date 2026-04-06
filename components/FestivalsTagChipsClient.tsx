"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { pub } from "@/lib/public-ui/styles";

/** Tailwind `md` — desktop uses more visible category chips before collapse. */
const MD_MIN_WIDTH_QUERY = "(min-width: 768px)";

function useMdOrUp(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(MD_MIN_WIDTH_QUERY);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(MD_MIN_WIDTH_QUERY).matches,
    () => false
  );
}

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
  /** `getServerSnapshot` is false so SSR/hydration match mobile (3); then `md` breakpoint → 5. */
  const firstVisible = useMdOrUp() ? 5 : 3;

  const { visibleCategories, showToggle } = useMemo(() => {
    const firstSlice = categories.slice(0, firstVisible);
    const selected = activeTag && categories.includes(activeTag) ? activeTag : null;
    const needsSelected = selected !== null && !firstSlice.includes(selected);
    const collapsed = needsSelected ? [...firstSlice, selected] : firstSlice;

    const hasHiddenCollapsed = categories.some((c) => !collapsed.includes(c));
    const show = expanded || hasHiddenCollapsed;

    return {
      visibleCategories: expanded ? categories : collapsed,
      showToggle: show,
    };
  }, [categories, activeTag, expanded, firstVisible]);

  const inactiveChipClass = cn(pub.chip, pub.focusRing);

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
            className={cn(pub.focusRing, "transition", active ? pub.chipActive : pub.chip)}
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
