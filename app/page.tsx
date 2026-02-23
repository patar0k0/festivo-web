import Navbar from "@/components/ui/Navbar";
import Button from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export const revalidate = 21600;

export default async function HomePage() {
  return (
    <div className="bg-white text-ink">
      <Navbar />

      <Section>
        <Container>
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">Festivo</p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Discover festivals with a calm, premium feel.
              </h1>
              <p className="max-w-2xl text-base text-neutral-600">
                Browse curated events, check dates, and plan weekends with a clean, focused experience.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" href="/festivals">
                Browse festivals
              </Button>
              <Button variant="secondary" size="lg" href="/map">
                Open map
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section background="muted">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Feed",
                description: "A simple, curated feed that highlights the best festivals near you.",
              },
              {
                title: "Map",
                description: "Explore by city and region with a calm, lightweight map experience.",
              },
              {
                title: "Plan",
                description: "Save favorites and build weekend plans in a single, tidy place.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
