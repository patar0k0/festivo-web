"use client";

import Link from "next/link";
import FestivalsDiscoverySearch from "@/components/festivals/FestivalsDiscoverySearch";
import CitySelectClient from "@/components/home/CitySelectClient";
import QuickChipsClient from "@/components/home/QuickChipsClient";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

type CityRow = { name: string; slug: string | null; filterValue: string };

export default function FestivalsListingDiscovery({
  chips,
  cityOptions,
  initialQuery,
}: {
  chips: Array<{ label: string; href: string }>;
  cityOptions: CityRow[];
  initialQuery: string;
}) {
  const secondaryDiscoveryActions = (
    <>
      {cityOptions.length ? (
        <CitySelectClient
          cities={cityOptions}
          homePath="/festivals"
          citySelectNavigateSuffix=""
        />
      ) : (
        <Link
          href="/festivals"
          className={cn(
            "rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-sm ring-1 ring-amber-100/30 transition hover:border-amber-300/55 hover:bg-white",
            pub.focusRing,
          )}
        >
          Избери град
        </Link>
      )}
      <Link
        href="/calendar"
        className={cn(
          "rounded-2xl border border-amber-200/40 bg-white/92 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-sm ring-1 ring-amber-100/30 transition hover:border-amber-300/55 hover:bg-white",
          pub.focusRing,
        )}
      >
        Избери дата
      </Link>
    </>
  );

  return (
    <div className={cn(pub.panelHero, "relative overflow-hidden p-4 md:p-5")}>
      <div className="relative z-[1]">
        <div className="mt-1">
          <FestivalsDiscoverySearch secondaryActions={secondaryDiscoveryActions} initialQuery={initialQuery} />
        </div>
        <div className="mt-3">
          <hr className="border-amber-900/20 my-1" />
          <QuickChipsClient chips={chips} />
        </div>
      </div>
    </div>
  );
}
