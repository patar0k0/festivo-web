import type { Metadata } from "next";
import { cookies } from "next/headers";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";
import RealHomePage from "@/components/home/RealHomePage";
import { firstHomeSearchParam, loadHomePageData } from "@/lib/home/loadHomePageData";
import "./landing.css";

const PREVIEW_COOKIE_NAME = "festivo_preview";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festivo - Очаквайте скоро",
  description: "Festivo стартира скоро.",
  alternates: {
    canonical: "https://festivo.bg/",
  },
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const cookieStore = await cookies();
  const previewCookie = cookieStore.get(PREVIEW_COOKIE_NAME)?.value;
  const hasPreviewAccess = Boolean(previewCookie);
  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const city = firstHomeSearchParam(searchParams.city)?.trim();

  if (comingSoonMode && !hasPreviewAccess) {
    return <ComingSoonPublic />;
  }

  const props = await loadHomePageData(city);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <RealHomePage {...props} />
    </div>
  );
}
