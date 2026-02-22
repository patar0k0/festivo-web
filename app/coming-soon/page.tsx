import type { Metadata } from "next";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Festivo – Безплатни фестивали в България",
  description: "Festivo ще ви помага да откривате безплатни фестивали в България. Стартира скоро.",
  alternates: {
    canonical: "https://festivo.bg/coming-soon",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Festivo",
    description: "Открий безплатни фестивали в България.",
    url: "https://festivo.bg",
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
        <p className="mt-3 text-sm text-muted">
          Festivo е нова платформа за откриване на безплатни фестивали в България.
        </p>
        <span className="sr-only">
          Festivo ще ви помага да откривате безплатни фестивали в България. Стартира скоро.
        </span>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
