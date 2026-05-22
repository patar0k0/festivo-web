"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
              Грешка
            </p>
            <h1 className={cn(pub.pageTitle, "mt-3 text-2xl md:text-3xl")}>
              Нещо се обърка
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/60 md:text-base">
              Имаме технически проблем в момента. Опитай отново след малко — ако грешката
              продължава, ни пиши.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={reset}
                type="button"
                className={cn(pub.btnPrimarySm, pub.focusRing, "min-w-[180px]")}
              >
                Опитай отново
              </button>
              <Link
                href="/"
                className={cn(pub.btnSecondarySm, pub.focusRing, "min-w-[180px]")}
              >
                Към началната страница
              </Link>
            </div>

            {error.digest ? (
              <p className="mt-8 font-mono text-[10px] text-black/40">
                Код за поддръжка: {error.digest}
              </p>
            ) : null}

            <p className="mt-2 text-xs text-black/50">
              Постоянен проблем?{" "}
              <a
                href="mailto:admin@festivo.bg"
                className="font-medium text-[#0c0e14] underline underline-offset-2"
              >
                admin@festivo.bg
              </a>
            </p>
          </div>
        </Container>
      </Section>
    </div>
  );
}
