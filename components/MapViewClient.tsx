"use client";

import dynamic from "next/dynamic";
import { Festival } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapViewClient({ festivals }: { festivals: Festival[] }) {
  return <MapView festivals={festivals} />;
}
