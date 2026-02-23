import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type DetailsSidebarProps = {
  dateText: string;
  venueText: string;
};

export default function DetailsSidebar({ dateText, venueText }: DetailsSidebarProps) {
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
          <Button variant="primary" size="lg" className="w-full">
            Get tickets
          </Button>
          <Button variant="secondary" size="lg" className="w-full">
            Add to favorites
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
