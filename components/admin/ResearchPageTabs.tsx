"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import SmartResearchPanel from "@/components/admin/SmartResearchPanel";
import ResearchFestivalPanel from "@/components/admin/ResearchFestivalPanel";

type Tab = "smart" | "classic";

function SerpApiKeyToggle() {
  const [active, setActive] = useState<"1" | "2" | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/admin/api/serpapi-key")
      .then((r) => r.json())
      .then((d) => setActive(d.active === "2" ? "2" : "1"))
      .catch(() => setActive("1"));
  }, []);

  function handleToggle() {
    startTransition(async () => {
      const r = await fetch("/admin/api/serpapi-key", { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        setActive(d.active === "2" ? "2" : "1");
      }
    });
  }

  if (active === null) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
        SerpAPI
      </span>
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={`Активен: Ключ ${active}. Натисни за смяна на Ключ ${active === "1" ? "2" : "1"}.`}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${
          active === "1"
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${active === "1" ? "bg-green-500" : "bg-orange-500"}`} />
        Ключ {active}
      </button>
    </div>
  );
}

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
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-1">
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
          <SerpApiKeyToggle />
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
