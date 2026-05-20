import Link from "next/link";
import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Страницата не е намерена · Festivo",
  description:
    "Страницата която търсиш не съществува или е преместена. Разгледай фестивалите в България на festivo.bg.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className={cn(pub.page, "min-h-[70vh]")}>
      <Section className="bg-transparent py-12 md:py-20">
        <Container>
          <div
            className={cn(
              pub.sectionCardSoft,
              "mx-auto max-w-xl p-8 text-center md:p-12",
            )}
          >
            {/* Accent bar */}
            <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-[#7c2d12]" />

            <p className="text-sm font-semibold uppercase tracking-wider text-[#7c2d12]">
              404
            </p>
            <h1 className={cn(pub.pageTitle, "mt-3 text-2xl md:text-3xl")}>
              Страницата не е намерена
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/60 md:text-base">
              Линкът който отвори не води до съществуваща страница. Може да е изтрит фестивал
              или сбъркан адрес.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className={cn(pub.btnPrimarySm, pub.focusRing, "min-w-[180px]")}
              >
                Към начална страница
              </Link>
              <Link
                href="/festivals"
                className={cn(pub.btnSecondarySm, pub.focusRing, "min-w-[180px]")}
              >
                Виж фестивалите
              </Link>
            </div>

            <p className="mt-8 text-xs text-black/50">
              Ако смяташ че това е грешка, пиши ни на{" "}
              <a
                href="mailto:hello@festivo.bg"
                className="font-medium text-[#0c0e14] underline underline-offset-2"
              >
                hello@festivo.bg
              </a>
            </p>
          </div>
        </Container>
      </Section>
    </div>
  );
}
