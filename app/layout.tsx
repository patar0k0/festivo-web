import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

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
        <main>{children}</main>
      </body>
    </html>
  );
}
