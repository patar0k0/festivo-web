import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { getBaseUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ContactForm } from "./ContactForm";

const canonical = `${getBaseUrl().replace(/\/$/, "")}/contact`;

export const metadata: Metadata = {
  title: "Контакт",
  description: "Свържи се с екипа на Festivo.bg — въпроси, обратна връзка и поддръжка.",
  alternates: { canonical },
  openGraph: {
    title: "Контакт · Festivo",
    description: "Изпрати съобщение до екипа на Festivo.bg.",
    url: canonical,
    siteName: "Festivo",
    locale: "bg_BG",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className={cn(pub.pageOverflow, pub.sectionLoose)}>
      <Container className="mx-auto max-w-lg">
        <p className={cn(pub.eyebrowMuted, "leading-relaxed")}>Festivo.bg</p>
        <h1 className={cn(pub.displayH1, "mt-2 text-2xl md:text-3xl")}>Контакт</h1>
        <p className={cn(pub.body, "mt-4 leading-relaxed")}>
          Попълни формата по-долу и ще отговорим, когато е възможно. За спешни въпроси към каталога виж и{" "}
          <Link href="/organizer" className={pub.linkInline}>
            зоната за организатори
          </Link>
          .
        </p>
        <ContactForm />
      </Container>
    </div>
  );
}
