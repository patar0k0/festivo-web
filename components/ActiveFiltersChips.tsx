"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";

type Chip = {
  key: string;
  label: string;
  onRemove: () => void;
};

const monthLabels = [
  "РЎРЏР Р…РЎС“Р В°РЎР‚Р С‘",
  "РЎвЂћР ВµР Р†РЎР‚РЎС“Р В°РЎР‚Р С‘",
  "Р СР В°РЎР‚РЎвЂљ",
  "Р В°Р С—РЎР‚Р С‘Р В»",
  "Р СР В°Р в„–",
  "РЎР‹Р Р…Р С‘",
  "РЎР‹Р В»Р С‘",
  "Р В°Р Р†Р С–РЎС“РЎРѓРЎвЂљ",
  "РЎРѓР ВµР С—РЎвЂљР ВµР СР Р†РЎР‚Р С‘",
  "Р С•Р С”РЎвЂљР С•Р СР Р†РЎР‚Р С‘",
  "Р Р…Р С•Р ВµР СР Р†РЎР‚Р С‘",
  "Р Т‘Р ВµР С”Р ВµР СР Р†РЎР‚Р С‘",
];

function splitCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMonth(month: string) {
  const [year, monthValue] = month.split("-");
  const monthIndex = Number(monthValue) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month;
  }
  return `${monthLabels[monthIndex]} ${year}`;
}

function formatDateRange(from: string | null, to: string | null) {
  if (from && to) return `Р вЂќР В°РЎвЂљР В°: ${from} - ${to}`;
  if (from) return `Р С›РЎвЂљ: ${from}`;
  if (to) return `Р вЂќР С•: ${to}`;
  return null;
}

export default function ActiveFiltersChips() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawParams = searchParams.toString();

  const pushWithParams = useCallback((nextParams: URLSearchParams) => {
    nextParams.delete("page");
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  const removeParam = useCallback((paramName: string) => {
    const nextParams = new URLSearchParams(rawParams);
    nextParams.delete(paramName);
    pushWithParams(nextParams);
  }, [pushWithParams, rawParams]);

  const removeFromCsv = useCallback((paramName: string, valueToRemove: string) => {
    const nextParams = new URLSearchParams(rawParams);
    const nextValues = splitCsv(nextParams.get(paramName)).filter((value) => value !== valueToRemove);
    if (nextValues.length) {
      nextParams.set(paramName, nextValues.join(","));
    } else {
      nextParams.delete(paramName);
    }
    pushWithParams(nextParams);
  }, [pushWithParams, rawParams]);

  const chips = useMemo<Chip[]>(() => {
    const items: Chip[] = [];
    const cityValues = splitCsv(searchParams.get("city"));
    const categoryValues = splitCsv(searchParams.get("cat"));
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const month = searchParams.get("month");
    const free = searchParams.get("free");
    const radius = searchParams.get("radius");
    const query = searchParams.get("q") ?? searchParams.get("search");

    cityValues.forEach((city) => {
      items.push({
        key: `city:${city}`,
        label: `Р вЂњРЎР‚Р В°Р Т‘: ${city}`,
        onRemove: () => removeFromCsv("city", city),
      });
    });

    categoryValues.forEach((category) => {
      items.push({
        key: `cat:${category}`,
        label: `Категория: ${labelForPublicCategory(category)}`,
        onRemove: () => removeFromCsv("cat", category),
      });
    });

    const dateLabel = formatDateRange(from, to);
    if (dateLabel) {
      items.push({
        key: "date",
        label: dateLabel,
        onRemove: () => {
          const nextParams = new URLSearchParams(rawParams);
          nextParams.delete("from");
          nextParams.delete("to");
          pushWithParams(nextParams);
        },
      });
    }

    if (month) {
      items.push({
        key: "month",
        label: `Р СљР ВµРЎРѓР ВµРЎвЂ : ${formatMonth(month)}`,
        onRemove: () => removeParam("month"),
      });
    }

    if (free === "1" || free === "true") {
      items.push({
        key: "free",
        label: "Р РЋР В°Р СР С• Р В±Р ВµР В·Р С—Р В»Р В°РЎвЂљР Р…Р С‘",
        onRemove: () => removeParam("free"),
      });
    }

    if (free === "0" || free === "false") {
      items.push({
        key: "paid",
        label: "Р РЋР В°Р СР С• Р С—Р В»Р В°РЎвЂљР ВµР Р…Р С‘",
        onRemove: () => removeParam("free"),
      });
    }

    if (radius) {
      items.push({
        key: "radius",
        label: `Р В Р В°Р Т‘Р С‘РЎС“РЎРѓ: ${radius} Р С”Р С`,
        onRemove: () => removeParam("radius"),
      });
    }

    if (query) {
      const queryParam = searchParams.get("q") ? "q" : "search";
      items.push({
        key: "query",
        label: `Р СћРЎР‰РЎР‚РЎРѓР ВµР Р…Р Вµ: \"${query}\"`,
        onRemove: () => removeParam(queryParam),
      });
    }

    return items;
  }, [pushWithParams, rawParams, removeFromCsv, removeParam, searchParams]);

  if (!chips.length) return null;

  return (
    <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max min-w-full gap-2 md:w-full md:flex-wrap">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.1] bg-white/90 px-3 py-2 text-xs font-semibold text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          >
            <span>{chip.label}</span>
            <span aria-hidden="true" className="text-black/55">
              Р“вЂ”
            </span>
            <span className="sr-only">Р СџРЎР‚Р ВµР СР В°РЎвЂ¦Р Р…Р С‘ РЎвЂћР С‘Р В»РЎвЂљРЎР‰РЎР‚</span>
          </button>
        ))}
      </div>
    </div>
  );
}
