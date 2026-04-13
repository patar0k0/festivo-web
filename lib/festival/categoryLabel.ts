export function categoryLabel(category?: string | null): string | null {
  if (!category) return null;

  const labels: Record<string, string> = {
    music: "Музика",
    folk: "Фолклор",
    arts: "Изкуство",
    food: "Храна",
    cultural: "Култура",
    sports: "Спорт",
    film: "Кино",
    theater: "Театър",
  };

  return labels[category.toLowerCase()] ?? category;
}
