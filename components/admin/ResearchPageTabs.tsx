"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SmartResearchPanel from "@/components/admin/SmartResearchPanel";
import ResearchFestivalPanel from "@/components/admin/ResearchFestivalPanel";

type Tab = "smart" | "classic";

function Tabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const active: Tab = (searchParams.get("tab") as Tab) === "classic" ? "classic" : "smart";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-black/[0.08] mb-6">
        <div className="flex gap-1 px-1">
          <button
            onClick={() => setTab("smart")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === "smart"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            ✨ Умно търсене
          </button>
          <button
            onClick={() => setTab("classic")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === "classic"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            Класическо
          </button>
        </div>
      </div>

      {/* Tab content */}
      {active === "smart" ? <SmartResearchPanel /> : <ResearchFestivalPanel />}
    </div>
  );
}

export default function ResearchPageTabs() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-black/40">Зареждане...</div>}>
      <Tabs />
    </Suspense>
  );
}
