export const revalidate = 86400;

export const metadata = {
  title: "Festivo – Безплатни фестивали в България",
  description: "Festivo ще ви помага да откривате безплатни фестивали в България. Стартира скоро.",
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
    description: "Платформа за откриване на безплатни фестивали в България.",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/[0.04] blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,0,0,0.04),transparent_60%)]" />
      </div>

      <div className="relative px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Очаквайте скоро</h1>
        <p className="mt-3 text-sm text-muted">
          Festivo е нова платформа за откриване на безплатни фестивали в България.
        </p>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
