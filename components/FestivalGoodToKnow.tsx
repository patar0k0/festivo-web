import { Festival } from "@/lib/types";

const rules = [
  { key: "Parking", keywords: ["parking", "park", "car", "паркинг", "паркомясто"] },
  { key: "Kids", keywords: ["kids", "children", "family", "деца", "семейство"] },
  { key: "Pets", keywords: ["pets", "dogs", "animals", "домашни", "кучета"] },
  { key: "Accessibility", keywords: ["accessible", "wheelchair", "access", "достъп", "инвалид"] },
  { key: "Food", keywords: ["food", "dining", "street food", "taste", "храна", "кулинар"] },
  { key: "Cash/Card", keywords: ["cash", "card", "payment", "плащане", "карта", "кеш"] },
];

export default function FestivalGoodToKnow({ festival }: { festival: Festival }) {
  const description = festival.description?.toLowerCase() ?? "";
  const items = rules
    .filter((rule) => rule.keywords.some((keyword) => description.includes(keyword)))
    .map((rule) => rule.key);

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Good to know</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
