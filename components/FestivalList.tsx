import { Festival } from "@/lib/types";
import FestivalCard from "@/components/FestivalCard";

export default function FestivalList({ festivals }: { festivals: Festival[] }) {
  return (
    <div className="space-y-4">
      {festivals.map((festival) => (
        <FestivalCard key={festival.id} festival={festival} />
      ))}
    </div>
  );
}
