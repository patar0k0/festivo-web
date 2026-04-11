import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Cormorant_Garamond, Fraunces, Manrope } from "next/font/google";
import LayoutShell from "@/components/LayoutShell";
import ClientProviders from "@/components/providers/ClientProviders";
import "./globals.css";
import "./landing.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-hero-warm-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://festivo.bg"),
  title: {
    default: "Festivo — Discover festivals in Bulgaria",
    template: "%s · Festivo",
  },
  description: "Browse published festivals, find dates, and plan weekends across Bulgaria.",
  icons: {
    icon: "/brand/festivo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        className={`${manrope.variable} ${fraunces.variable} ${cormorantGaramond.variable} landing-bg min-h-screen text-[#0c0e14] antialiased`}
      >
        <ClientProviders>
          <LayoutShell>{children}</LayoutShell>
        </ClientProviders>
        <Analytics />
      </body>
    </html>
  );
}
