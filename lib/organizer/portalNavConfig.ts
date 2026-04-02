export type OrganizerNavLink = { href: string; label: string };

export const ORGANIZER_PORTAL_LINKS: OrganizerNavLink[] = [
  { href: "/organizer/dashboard", label: "Табло" },
  { href: "/organizer/profile/new", label: "Нов профил" },
  { href: "/organizer/claim", label: "Заявка за профил" },
  { href: "/organizer/festivals/new", label: "Ново подаване" },
  { href: "/organizer/submissions", label: "Моите подавания" },
];

export const ORGANIZER_ONBOARDING_LINKS: OrganizerNavLink[] = [
  { href: "/organizer", label: "Начало" },
  { href: "/organizer/profile/new", label: "Нов профил" },
  { href: "/organizer/claim", label: "Заявка за профил" },
];
