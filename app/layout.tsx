import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Container from "@/components/ui/Container";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg"),
  title: {
    default: "Festivo — Discover festivals in Bulgaria",
    template: "%s · Festivo",
  },
  description: "Browse verified festivals, find dates, and plan weekends across Bulgaria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body className={`${manrope.variable} ${fraunces.variable} bg-white text-ink antialiased`}>
        <header className="border-b border-ink/10">
          <Container>
            <div className="flex items-center justify-between py-6">
              <Link href="/" className="text-lg font-semibold">
                Festivo
              </Link>
              <nav className="flex items-center gap-6 text-sm font-semibold text-ink">
                <Link href="/festivals">Festivals</Link>
                <Link href="/map">Map</Link>
                <Link href="/calendar">Calendar</Link>
              </nav>
            </div>
          </Container>
        </header>

        <main>
          <Container>{children}</Container>
        </main>

        <footer className="border-t border-ink/10 py-10">
          <Container>
            <p className="text-center text-sm text-muted">© Festivo • Безплатни фестивали в България</p>
          </Container>
        </footer>
      </body>
    </html>
  );
}
