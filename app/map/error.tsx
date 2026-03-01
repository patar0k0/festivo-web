"use client";

import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import "../landing.css";

export default function MapError({ reset }: { reset: () => void }) {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <Section className="bg-transparent py-12">
        <Container>
          <div className="mx-auto max-w-xl rounded-2xl border border-black/[0.08] bg-white/85 p-8 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
            <h1 className="text-2xl font-black tracking-tight">Възникна грешка</h1>
            <p className="mt-2 text-sm text-black/60">Не успяхме да заредим картата на фестивалите.</p>
            <button
              onClick={reset}
              className="mt-5 rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            >
              Опитай пак
            </button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
