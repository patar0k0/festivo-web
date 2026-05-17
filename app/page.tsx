import type { Metadata } from "next";
import { cookies } from "next/headers";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";
import RealHomePage from "@/components/home/RealHomePage";
import { firstHomeSearchParam, loadHomePageData } from "@/lib/home/loadHomePageData";

const PREVIEW_COOKIE_NAME = "festivo_preview";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festivo.bg — Открий, планирай и посети фестивалите в България",
  description: "Открий безплатни фестивали в България по град, дата и интерес. Проверени събития от организатори и публични източници.",
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
