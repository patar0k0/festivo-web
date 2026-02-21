import { toTitleCase } from "@/lib/utils";

export default function CityIntro({ city }: { city: string }) {
  const name = toTitleCase(city);
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-soft">
      <h1 className="text-3xl font-semibold">Фестивали в {name}</h1>
      <p className="mt-3 text-sm text-muted">
        Открийте подбрани фестивали в {name}. Филтрирайте по дата, категория и свободен вход.
      </p>
      <p className="mt-2 text-sm text-muted">
        Festivo събира verified събития, за да планирате уикендите по-лесно.
      </p>
    </div>
  );
}
