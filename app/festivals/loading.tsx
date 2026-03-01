import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_20px_rgba(12,14,20,0.06)]">
      <div className="h-56 animate-pulse bg-black/[0.07]" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-2/3 animate-pulse rounded bg-black/[0.08]" />
        <div className="h-5 w-full animate-pulse rounded bg-black/[0.1]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-black/[0.08]" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-black/[0.1]" />
      </div>
    </div>
  );
}

export default function FestivalsLoading() {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <Section className="bg-transparent py-8 md:py-10">
        <Container>
          <div className="space-y-6">
            <div className="h-36 animate-pulse rounded-[28px] border border-black/[0.08] bg-white/75" />
            <div className="h-20 animate-pulse rounded-2xl border border-black/[0.08] bg-white/75" />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
