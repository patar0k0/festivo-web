"use client";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export default function CalendarError({ reset }: { reset: () => void }) {
  return (
    <div className={cn(pub.page, "min-h-screen")}>
      <Section className="bg-transparent py-12">
        <Container>
          <div className={cn(pub.sectionCardSoft, "mx-auto max-w-xl p-8 text-center")}>
            <h1 className={cn(pub.pageTitle, "text-2xl")}>Възникна грешка</h1>
            <p className="mt-2 text-sm text-black/60">Не успяхме да заредим календара на фестивалите.</p>
            <button
              onClick={reset}
              className={cn("mt-5", pub.btnPrimarySm, pub.focusRing)}
            >
              Опитай пак
            </button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
