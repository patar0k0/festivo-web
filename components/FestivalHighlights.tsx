import { Festival } from "@/lib/types";

export default function FestivalHighlights({ festival }: { festival: Festival }) {
  if (!festival.description) return null;

  const sentences = festival.description
    .split(/\.|\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (sentences.length < 3) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Highlights</h2>
      <ul className="space-y-2 text-sm text-muted">
        {sentences.map((sentence, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
