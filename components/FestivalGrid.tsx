import { Festival } from "@/lib/types";
import FestivalCard from "@/components/FestivalCard";

export default function FestivalGrid({ festivals }: { festivals: Festival[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {festivals.map((festival) => (
        <FestivalCard key={festival.id} festival={festival} />
      ))}
    </div>
  );
}
