import Link from "next/link";
import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Фестивалът не е намерен · Festivo",
  description:
    "Този фестивал не съществува или е премахнат. Разгледай всички верифицирани фестивали в България.",
  robots: { index: false, follow: false },
};

export default function FestivalNotFound() {
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
            <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-[#7c2d12]" />

            <p className="text-sm font-semibold uppercase tracking-wider text-[#7c2d12]">
              404
            </p>
            <h1 className={cn(pub.pageTitle, "mt-3 text-2xl md:text-3xl")}>
              Този фестивал не съществува
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/60 md:text-base">
              Възможно е да е премахнат или линкът да е сбъркан. Разгледай останалите
              верифицирани фестивали в България.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/festivals"
                className={cn(pub.btnPrimarySm, pub.focusRing, "min-w-[180px]")}
              >
                Виж всички фестивали
              </Link>
              <Link
                href="/calendar"
                className={cn(pub.btnSecondarySm, pub.focusRing, "min-w-[180px]")}
              >
                Към календара
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
