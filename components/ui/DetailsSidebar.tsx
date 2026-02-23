import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type DetailsSidebarProps = {
  dateText: string;
  venueText: string;
  mapHref?: string | null;
};

export default function DetailsSidebar({ dateText, venueText, mapHref }: DetailsSidebarProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Date & Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">{dateText}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">{venueText}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-600">
            Map placeholder
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" disabled>
            Plan скоро
          </Button>
          {mapHref ? (
            <Button variant="secondary" size="lg" className="w-full" href={mapHref}>
              Open map
            </Button>
          ) : null}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Reminder</span>
            <Select className="w-full">
              <option value="none">None</option>
              <option value="24h">24h before</option>
              <option value="same-day">Same day 09:00</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
