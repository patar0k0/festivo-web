"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; match: "exact" | "prefix" }[] = [
  { href: "/admin", label: "Табло", match: "exact" },
  { href: "/admin/festivals", label: "Фестивали", match: "prefix" },
  { href: "/admin/organizers", label: "Организатори", match: "prefix" },
  { href: "/admin/organizer-claims", label: "Заявки орг.", match: "prefix" },
  { href: "/admin/pending-festivals", label: "Чакащи", match: "prefix" },
  { href: "/admin/ingest", label: "Внасяне", match: "prefix" },
  { href: "/admin/discovery", label: "Открития", match: "prefix" },
  { href: "/admin/research", label: "Проучване", match: "prefix" },
  { href: "/admin/outbound", label: "Кликове", match: "prefix" },
];

function navActive(pathname: string | null, href: string, match: "exact" | "prefix") {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/$/, "") || "/";
  const hrefNorm = href.replace(/\/$/, "") || "/";
  if (match === "exact") {
    return normalized === hrefNorm;
  }
  return normalized === hrefNorm || normalized.startsWith(`${hrefNorm}/`);
}

export default function AdminTopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
      {NAV.map((item) => {
        const active = navActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl border px-3 py-2 transition-colors ${
              active
                ? "border-black/[0.18] bg-black/[0.07] text-[#0c0e14]"
                : "border-black/[0.1] bg-white hover:bg-[#f7f6f3]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
