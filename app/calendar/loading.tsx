import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import "../landing.css";

function CalendarSkeletonCell() {
  return <div className="h-20 animate-pulse rounded-xl border border-black/[0.08] bg-white/80" />;
}

export default function CalendarLoading() {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
        <Container>
          <div className="space-y-7 lg:space-y-8">
            <div className="h-56 animate-pulse rounded-[28px] border border-black/[0.08] bg-white/75" />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 md:p-5">
                <div className="mb-4 h-10 animate-pulse rounded-xl bg-black/[0.08]" />
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }).map((_, index) => (
                    <CalendarSkeletonCell key={index} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 md:p-5">
                <div className="h-10 animate-pulse rounded-xl bg-black/[0.08]" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-xl bg-black/[0.06]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
