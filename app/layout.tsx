import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import Container from "@/components/ui/Container";
import SiteHeader from "@/app/_components/SiteHeader";

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
        <SiteHeader />

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
