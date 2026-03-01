import type { Metadata } from "next";
import { cookies } from "next/headers";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";
import RealHomePage from "@/components/home/RealHomePage";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { listCities, listFestivals } from "@/lib/festivals";
import "./landing.css";

const PREVIEW_COOKIE_NAME = "festivo_preview";

export const metadata: Metadata = {
  title: "Festivo - Очаквайте скоро",
  description: "Festivo стартира скоро.",
  alternates: {
    canonical: "https://festivo.bg/",
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const previewToken = process.env.PREVIEW_TOKEN;
  const previewCookie = cookieStore.get(PREVIEW_COOKIE_NAME)?.value;
  const hasPreviewAccess = Boolean(previewToken) && previewCookie === previewToken;

  if (!hasPreviewAccess) {
    return <ComingSoonPublic />;
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const weekendStart = format(nextSaturday(new Date()), "yyyy-MM-dd");
  const weekendEnd = format(nextSunday(new Date()), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [nearestResult, weekendResult, citiesResult] = await Promise.all([
    listFestivals(withDefaultFilters({ from: today }), 1, 6, { applyDefaults: false }).catch(() => ({
      data: [],
      page: 1,
      pageSize: 6,
      total: 0,
      totalPages: 1,
    })),
    listFestivals(withDefaultFilters({ from: weekendStart, to: weekendEnd }), 1, 6, { applyDefaults: false }).catch(
      () => ({
        data: [],
        page: 1,
        pageSize: 6,
        total: 0,
        totalPages: 1,
      })
    ),
    listCities().catch(() => []),
  ]);

  const quickChipHrefs = {
    free: `/festivals${serializeFilters(withDefaultFilters({ free: true }))}`,
    weekend: `/festivals${serializeFilters(withDefaultFilters({ from: weekendStart, to: weekendEnd }))}`,
    month: `/festivals${serializeFilters(withDefaultFilters({ from: monthStart, to: monthEnd }))}`,
    categories: ["folk", "jazz", "food", "art"].map(
      (category) => `/festivals${serializeFilters(withDefaultFilters({ cat: [category] }))}`
    ),
  };

  return (
    <RealHomePage
      nearestFestivals={nearestResult.data}
      weekendFestivals={weekendResult.data}
      topCities={citiesResult.slice(0, 8)}
      quickChipHrefs={quickChipHrefs}
    />
  );
}
