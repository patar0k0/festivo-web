import type { Metadata } from "next";

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
    <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Очаквайте скоро</h1>
        <span className="sr-only">
          Festivo стартира скоро – платформа за откриване на безплатни фестивали в България.
        </span>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
