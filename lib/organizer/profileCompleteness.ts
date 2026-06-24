export type OrganizerCompletenessInput = {
  logo_url: string;
  description: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  phone: string;
  festivalCount: number;
};

export type OrganizerCompletenessItemKey = "logo" | "description" | "links" | "contact" | "festival";

export type OrganizerCompletenessItem = {
  key: OrganizerCompletenessItemKey;
  label: string;
  done: boolean;
};

export type OrganizerCompletenessResult = {
  items: OrganizerCompletenessItem[];
  doneCount: number;
  total: number;
};

/**
 * 5 equally-weighted profile completeness signals for the organizer-facing portal.
 * `verified` is intentionally excluded — it's admin-only and not actionable by the organizer.
 */
export function computeOrganizerCompleteness(input: OrganizerCompletenessInput): OrganizerCompletenessResult {
  const items: OrganizerCompletenessItem[] = [
    { key: "logo", label: "Лого", done: Boolean(input.logo_url.trim()) },
    { key: "description", label: "Описание", done: Boolean(input.description.trim()) },
    {
      key: "links",
      label: "Уебсайт или социална мрежа",
      done: Boolean(input.website_url.trim() || input.facebook_url.trim() || input.instagram_url.trim()),
    },
    {
      key: "contact",
      label: "Контакт (имейл или телефон)",
      done: Boolean(input.email.trim() || input.phone.trim()),
    },
    { key: "festival", label: "Поне 1 фестивал в каталога", done: input.festivalCount > 0 },
  ];

  const doneCount = items.filter((item) => item.done).length;

  return { items, doneCount, total: items.length };
}
