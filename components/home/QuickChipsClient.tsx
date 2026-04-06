"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

type QuickChipsClientProps = {
  chips: Array<{ label: string; href: string }>;
};

const CATEGORY_CHIPS_DEFAULT_VISIBLE_COUNT = 3;

function getCategoryTagFromHref(href: string): string | null {
  const parsedHref = new URL(href, "https://festivo.local");
  return parsedHref.searchParams.get("tag");
}

function isChipActive(href: string, pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const parsedHref = new URL(href, "https://festivo.local");
  const chipParams = parsedHref.searchParams;

  if (!chipParams.toString()) {
    return false;
  }

  const targetPath = parsedHref.pathname === "/" ? pathname : parsedHref.pathname;
  if (targetPath !== pathname) {
    return false;
  }

  return Array.from(chipParams.entries()).every(([key, value]) => searchParams.get(key) === value);
}

function chipClassName(active: boolean) {
  return cn(
    "whitespace-nowrap md:whitespace-normal snap-start rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
    pub.focusRing,
    active
      ? "border-[#7c2d12]/35 bg-[#7c2d12]/10 text-[#0c0e14]"
      : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white",
  );
}

export default function QuickChipsClient({ chips }: QuickChipsClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");
  const [expanded, setExpanded] = useState(false);

  const { nonCategoryChips, categoryChips } = useMemo(() => {
    const non: QuickChipsClientProps["chips"] = [];
    const cats: QuickChipsClientProps["chips"] = [];

    for (const chip of chips) {
      const tag = getCategoryTagFromHref(chip.href);
      if (tag) cats.push(chip);
      else non.push(chip);
    }

    return { nonCategoryChips: non, categoryChips: cats };
  }, [chips]);

  const { firstSliceCategoryChips, selectedExtraChip, hasMoreCategories } = useMemo(() => {
    const firstSlice = categoryChips.slice(0, CATEGORY_CHIPS_DEFAULT_VISIBLE_COUNT);
    const selectedTag = activeTag?.trim() ? activeTag.trim() : null;
    const selectedChip =
      selectedTag ? categoryChips.find((c) => getCategoryTagFromHref(c.href) === selectedTag) ?? null : null;

    const isSelectedInFirstSlice = selectedChip
      ? firstSlice.some((c) => getCategoryTagFromHref(c.href) === selectedTag)
      : false;

    const selectedExtraChip = selectedChip && !isSelectedInFirstSlice ? selectedChip : null;

    const collapsedVisibleCategories = selectedExtraChip ? [...firstSlice, selectedExtraChip] : firstSlice;
    const hasMoreCategories = categoryChips.some(
      (c) => !collapsedVisibleCategories.some((cc) => cc.href === c.href)
    );

    return { firstSliceCategoryChips: firstSlice, selectedExtraChip, hasMoreCategories };
  }, [activeTag, categoryChips]);

  const showToggle = expanded || hasMoreCategories;

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
      {nonCategoryChips.map((chip) => (
        <Link
          key={`${chip.label}-${chip.href}`}
          href={chip.href}
          className={chipClassName(isChipActive(chip.href, pathname, searchParams))}
        >
          {chip.label}
        </Link>
      ))}

      {expanded ? (
        <>
          {categoryChips.map((chip) => (
            <Link
              key={`${chip.label}-${chip.href}`}
              href={chip.href}
              className={chipClassName(isChipActive(chip.href, pathname, searchParams))}
            >
              {chip.label}
            </Link>
          ))}
          {showToggle ? (
            <button type="button" onClick={() => setExpanded(false)} className={chipClassName(false)}>
              По-малко ←
            </button>
          ) : null}
        </>
      ) : (
        <>
          {firstSliceCategoryChips.map((chip) => (
            <Link
              key={`${chip.label}-${chip.href}`}
              href={chip.href}
              className={chipClassName(isChipActive(chip.href, pathname, searchParams))}
            >
              {chip.label}
            </Link>
          ))}

          {selectedExtraChip ? (
            <Link
              key={`${selectedExtraChip.label}-${selectedExtraChip.href}`}
              href={selectedExtraChip.href}
              className={chipClassName(isChipActive(selectedExtraChip.href, pathname, searchParams))}
            >
              {selectedExtraChip.label}
            </Link>
          ) : null}

          {hasMoreCategories ? (
            <button type="button" onClick={() => setExpanded(true)} className={chipClassName(false)}>
              Още →
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
