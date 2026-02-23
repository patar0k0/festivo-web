import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Container from "@/app/_components/ui/Container";
import Button from "@/app/_components/ui/Button";

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
      <body className={`${manrope.variable} ${fraunces.variable} apple-bg text-[color:var(--text)] antialiased`}>
        <header className="sticky top-0 z-40 border-b border-black/10 bg-white/80 backdrop-blur">
          <Container className="flex h-16 items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Festivo
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
              <Link href="/festivals" className="transition hover:text-neutral-900">
                Фестивали
              </Link>
              <Link href="/calendar" className="transition hover:text-neutral-900">
                Календар
              </Link>
              <Link href="/map" className="transition hover:text-neutral-900">
                Карта
              </Link>
            </nav>
            <Button variant="primary">Отвори в app</Button>
          </Container>
        </header>
        <main className="mx-auto max-w-[1240px] px-5">{children}</main>
      </body>
    </html>
  );
}
