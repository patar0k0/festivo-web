"use client";

import dynamic from "next/dynamic";
import { Festival } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-[#f1efe8] text-sm font-semibold text-black/60">
      Зареждане на картата...
    </div>
  ),
});

export default function MapViewClient({ festivals }: { festivals: Festival[] }) {
  return <MapView festivals={festivals} />;
}
