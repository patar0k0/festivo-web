import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import "../landing.css";

function MapSkeletonCard() {
  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_20px_rgba(12,14,20,0.06)]">
      <div className="h-4 w-2/3 animate-pulse rounded bg-black/[0.08]" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-black/[0.08]" />
      <div className="h-28 animate-pulse rounded-xl bg-black/[0.06]" />
    </div>
  );
}

export default function MapLoading() {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <Section className="bg-transparent py-8 md:py-10">
        <Container>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-[28px] border border-black/[0.08] bg-white/75" />
            <div className="h-[58vh] min-h-[360px] animate-pulse rounded-2xl border border-black/[0.08] bg-white/80" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <MapSkeletonCard key={index} />
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
