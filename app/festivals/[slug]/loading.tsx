import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function FestivalDetailLoading() {
  return (
    <div className="min-h-screen text-[#0c0e14]">
      <Section className="bg-transparent py-8 md:py-10">
        <Container>
          <div className="space-y-6">
            {/* Hero placeholder */}
            <div className="h-[280px] animate-pulse rounded-[28px] border border-black/[0.08] bg-white/75 md:h-[400px]" />

            {/* Title + meta */}
            <div className="space-y-3">
              <div className="h-8 w-2/3 animate-pulse rounded bg-black/[0.08]" />
              <div className="h-5 w-1/3 animate-pulse rounded bg-black/[0.07]" />
            </div>

            {/* Body grid */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-4 md:col-span-2">
                <div className="h-32 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
                <div className="h-48 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
                <div className="h-40 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
              </div>
              <div className="space-y-4">
                <div className="h-56 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
                <div className="h-32 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
