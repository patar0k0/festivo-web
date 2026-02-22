import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import BuildStamp from "@/app/_components/BuildStamp";

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
      <body className={`${manrope.variable} ${fraunces.variable} antialiased`}>
        <LayoutShell>
          {children}
          <footer className="bg-white px-6 pb-10">
            <div className="mx-auto w-full max-w-6xl">
              <BuildStamp />
            </div>
          </footer>
        </LayoutShell>
      </body>
    </html>
  );
}
