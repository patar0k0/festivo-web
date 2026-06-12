import type { Metadata } from "next";
import { cookies } from "next/headers";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";
import RealHomePage from "@/components/home/RealHomePage";
import { firstHomeSearchParam, loadHomePageData } from "@/lib/home/loadHomePageData";
import { dailyRotationSeed } from "@/lib/home/dailyRotation";

const PREVIEW_COOKIE_NAME = "festivo_preview";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festivo.bg — Всички фестивали в България на едно място",
  description: "Открий безплатни фестивали в България по град, дата и интерес. Проверени събития от организатори и публични източници. Планирай уикенда си безплатно с Festivo.",
  alternates: {
    canonical: "https://festivo.bg/",
  },
  openGraph: {
    title: "Festivo — Фестивалите на България на едно място",
    description: "Открий безплатни фестивали в България по град, дата и интерес. Проверени събития от организатори и публични източници.",
    url: "https://festivo.bg/",
    siteName: "Festivo",
    locale: "bg_BG",
    type: "website",
    images: [
      {
        url: "https://festivo.bg/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Festivo — Фестивалите на България на едно място",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Festivo — Фестивалите на България на едно място",
    description: "Открий безплатни фестивали в България по град, дата и интерес.",
    images: ["https://festivo.bg/opengraph-image"],
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

  // Preview-only ротационен seed override. Само при наличие на festivo_preview
  // cookie — иначе параметрите изобщо не се четат, нормалното кешируемо
  // поведение остава непроменено. `?rotday=YYYY-MM-DD` има предимство пред
  // `?rotseed=<число>`; невалидни стойности се игнорират.
  let seedOverride: number | undefined;
  if (hasPreviewAccess) {
    const rawRotday = firstHomeSearchParam(searchParams.rotday)?.trim();
    const rawRotseed = firstHomeSearchParam(searchParams.rotseed)?.trim();
    if (rawRotday && /^\d{4}-\d{2}-\d{2}$/.test(rawRotday)) {
      seedOverride = dailyRotationSeed(rawRotday);
    } else if (rawRotseed) {
      const parsed = Number.parseInt(rawRotseed, 10);
      if (Number.isFinite(parsed)) seedOverride = parsed >>> 0;
    }
  }

  const props = await loadHomePageData(city, seedOverride);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Festivo",
    url: "https://festivo.bg",
    logo: "https://festivo.bg/brand/festivo-logo.svg",
    description: "Каталог на фестивалите в България — открий, планирай и посети.",
    sameAs: [
      "https://www.facebook.com/festivo.bg",
      "https://www.instagram.com/festivo.bg",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <div className="mx-auto max-w-6xl px-4">
        <RealHomePage {...props} />
      </div>
    </>
  );
}
