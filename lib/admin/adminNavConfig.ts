export type AdminNavItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Основно",
    items: [{ href: "/admin", label: "Табло", match: "exact" }],
  },
  {
    label: "Потребители",
    items: [
      { href: "/admin/users", label: "Потребители", match: "prefix" },
      { href: "/admin/organizers", label: "Организатори", match: "prefix" },
      { href: "/admin/organizer-claims", label: "Заявки орг.", match: "prefix" },
    ],
  },
  {
    label: "Съдържание",
    items: [
      { href: "/admin/ingest", label: "Внасяне", match: "prefix" },
      { href: "/admin/discovery", label: "Открития", match: "prefix" },
      { href: "/admin/research", label: "Проучване", match: "prefix" },
      { href: "/admin/pending-festivals", label: "Чакащи", match: "prefix" },
      { href: "/admin/festivals", label: "Фестивали", match: "exact" },
      { href: "/admin/festivals/duplicates", label: "Дублирани", match: "prefix" },
      { href: "/admin/festival-reports", label: "Сигнали", match: "prefix" },
    ],
  },
  {
    label: "Монетизация",
    items: [
      { href: "/admin/promotions", label: "Промо", match: "prefix" },
      { href: "/admin/promotion-requests", label: "Заявки", match: "prefix" },
      { href: "/admin/analytics", label: "Анализи", match: "prefix" },
    ],
  },
  {
    label: "Система",
    items: [
      { href: "/admin/activity", label: "Активност", match: "prefix" },
      { href: "/admin/email-jobs", label: "Имейли", match: "prefix" },
      { href: "/admin/outbound", label: "Кликове", match: "prefix" },
      { href: "/admin/observability", label: "Observability", match: "prefix" },
    ],
  },
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
