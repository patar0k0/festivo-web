import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { getOptionalUser } from "@/lib/authUser";

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
  description: "Browse published festivals, find dates, and plan weekends across Bulgaria.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalUser();

  return (
    <html lang="bg">
      <body className={`${manrope.variable} ${fraunces.variable} text-neutral-900 antialiased`}>
        <LayoutShell userEmail={user?.email ?? undefined}>{children}</LayoutShell>
      </body>
    </html>
  );
}
