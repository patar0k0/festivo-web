import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import CalendarClient from "@/app/calendar/CalendarClient";

export const revalidate = 3600;

export default function CalendarPage() {
  return (
    <div className="bg-white text-neutral-900">
      <Section>
        <Container>
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Calendar</h1>
              <p className="text-sm text-neutral-600 md:text-base">
                Switch between upcoming events and full month overviews.
              </p>
            </div>
            <CalendarClient />
          </div>
        </Container>
      </Section>
    </div>
  );
}
