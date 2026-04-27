export type OrganizerNavLink = { href: string; label: string };

/** Owner-only workspace sidebar (dashboard, submissions, new festival). */
export const ORGANIZER_PORTAL_LINKS_OWNER: OrganizerNavLink[] = [
  { href: "/organizer/dashboard", label: "Табло" },
  { href: "/organizer/submissions", label: "Моите подавания" },
  { href: "/organizer/festivals/new", label: "Нов фестивал" },
];

/** Non-owner signed-in users (e.g. pending claim): onboarding links only. */
export const ORGANIZER_PORTAL_LINKS_NON_OWNER: OrganizerNavLink[] = [
  { href: "/organizer/profile/new", label: "Нов профил" },
  { href: "/organizer/claim", label: "Заявка за профил" },
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
