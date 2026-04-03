export type AdminNavItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Табло", match: "exact" },
  { href: "/admin/users", label: "Потребители", match: "prefix" },
  { href: "/admin/activity", label: "Активност", match: "prefix" },
  { href: "/admin/email-jobs", label: "Имейли", match: "prefix" },
  { href: "/admin/festivals", label: "Фестивали", match: "prefix" },
  { href: "/admin/organizers", label: "Организатори", match: "prefix" },
  { href: "/admin/organizer-claims", label: "Заявки орг.", match: "prefix" },
  { href: "/admin/pending-festivals", label: "Чакащи", match: "prefix" },
  { href: "/admin/ingest", label: "Внасяне", match: "prefix" },
  { href: "/admin/discovery", label: "Открития", match: "prefix" },
  { href: "/admin/research", label: "Проучване", match: "prefix" },
  { href: "/admin/outbound", label: "Кликове", match: "prefix" },
];

export function adminNavActive(pathname: string | null, href: string, match: "exact" | "prefix"): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/$/, "") || "/";
  const hrefNorm = href.replace(/\/$/, "") || "/";
  if (match === "exact") {
    return normalized === hrefNorm;
  }
  return normalized === hrefNorm || normalized.startsWith(`${hrefNorm}/`);
}
