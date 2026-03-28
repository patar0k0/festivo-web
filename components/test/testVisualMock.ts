export type MockFestival = {
  id: string;
  title: string;
  city: string;
  category: string;
  free: boolean;
  weekend: boolean;
  image: string;
  dateLabel: string;
};

export const MOCK_CITIES = [
  "София",
  "Пловдив",
  "Варна",
  "Бургас",
  "Русе",
  "Стара Загора",
  "Велико Търново",
  "Благоевград",
] as const;

export const MOCK_FESTIVALS: MockFestival[] = [
  {
    id: "1",
    title: "Sofia Live Festival",
    city: "София",
    category: "Музика",
    free: false,
    weekend: true,
    dateLabel: "12–14 юни 2026",
    image:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "2",
    title: "Кино под звездите",
    city: "Пловдив",
    category: "Кино",
    free: true,
    weekend: true,
    dateLabel: "20 юни 2026",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "3",
    title: "Фолклорни ритми",
    city: "Копривщица",
    category: "Традиции",
    free: true,
    weekend: false,
    dateLabel: "7 август 2026",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "4",
    title: "Джаз в парка",
    city: "Варна",
    category: "Музика",
    free: true,
    weekend: true,
    dateLabel: "3 юли 2026",
    image:
      "https://images.unsplash.com/photo-1415201368604-7c730bc2cd9d?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "5",
    title: "Улично изкуство Пловдив",
    city: "Пловдив",
    category: "Изкуство",
    free: true,
    weekend: false,
    dateLabel: "Септември 2026",
    image:
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "6",
    title: "Електронни нощи",
    city: "София",
    category: "Музика",
    free: false,
    weekend: true,
    dateLabel: "15 ноември 2026",
    image:
      "https://images.unsplash.com/photo-1574391884720-bbc3740c59d7?w=800&q=80&auto=format&fit=crop",
  },
];

export type FilterId = "all" | "free" | "weekend" | "music";

export const FILTER_CHIPS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Всички" },
  { id: "free", label: "Безплатни" },
  { id: "weekend", label: "Уикенд" },
  { id: "music", label: "Музика" },
];
