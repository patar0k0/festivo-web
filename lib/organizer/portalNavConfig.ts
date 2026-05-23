export type OrganizerNavLink = {
  href: string;
  label: string;
  /**
   * Optional emoji/glyph rendered before the label in sidebar nav.
   * Keep to single-char emoji for layout stability.
   */
  icon?: string;
};

/** Owner-only workspace sidebar (dashboard, submissions, new festival). */
export const ORGANIZER_PORTAL_LINKS_OWNER: OrganizerNavLink[] = [
  { href: "/organizer/dashboard", label: "Табло", icon: "🏠" },
  { href: "/organizer/submissions", label: "Моите подавания", icon: "📋" },
  { href: "/organizer/festivals/new", label: "Добави фестивал", icon: "➕" },
];

/** Non-owner signed-in users (e.g. pending claim): onboarding links only. */
export const ORGANIZER_PORTAL_LINKS_NON_OWNER: OrganizerNavLink[] = [
  { href: "/organizer/profile/new", label: "Нов профил", icon: "✨" },
  { href: "/organizer/claim", label: "Заявка за профил", icon: "📋" },
];

export const ORGANIZER_PORTAL_LINKS: OrganizerNavLink[] = [
  ...ORGANIZER_PORTAL_LINKS_OWNER,
  ...ORGANIZER_PORTAL_LINKS_NON_OWNER,
];

export const ORGANIZER_ONBOARDING_LINKS: OrganizerNavLink[] = [
  { href: "/organizer", label: "Начало" },
  { href: "/organizer/profile/new", label: "Нов профил" },
  { href: "/organizer/claim", label: "Заявка за профил" },
];
