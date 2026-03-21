import type { Metadata } from "next";
import ComingSoonPublic from "@/components/home/ComingSoonPublic";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Festivo – Очаквайте скоро",
  description: "Festivo стартира скоро – платформа за откриване на безплатни фестивали в България.",
  alternates: {
    canonical: "https://festivo.bg/coming-soon",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Festivo – Очаквайте скоро",
    description: "Платформа за откриване на безплатни фестивали в България. Стартира скоро.",
    url: "https://festivo.bg/coming-soon",
    siteName: "Festivo",
    locale: "bg_BG",
    type: "website",
  },
};

export default function ComingSoonPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Festivo",
    url: "https://festivo.bg",
  };

  return (
    <>
      <ComingSoonPublic />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
