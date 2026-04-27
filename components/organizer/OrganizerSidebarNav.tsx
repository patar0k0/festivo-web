"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ORGANIZER_PORTAL_LINKS_NON_OWNER, ORGANIZER_PORTAL_LINKS_OWNER } from "@/lib/organizer/portalNavConfig";

function linkActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (h === "/organizer/dashboard") {
    return n === h;
  }
  return n === h || n.startsWith(`${h}/`);
}

/** Organizer workspace sidebar; links depend on active owner membership (server-provided). */
export default function OrganizerSidebarNav({ isOrganizerOwner }: { isOrganizerOwner: boolean }) {
  const pathname = usePathname();
  const links = isOrganizerOwner ? ORGANIZER_PORTAL_LINKS_OWNER : ORGANIZER_PORTAL_LINKS_NON_OWNER;

  return (
    <nav aria-label="Зона за организатори" className="flex flex-col gap-2">
      <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40 md:block">Навигация</p>
      <div className="flex flex-wrap gap-2 md:flex-col md:gap-2">
        {links.map((item) => {
          const active = linkActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors md:w-full ${
                active
                  ? "border-black/[0.16] bg-black/[0.05] text-[#0c0e14]"
                  : "border-black/[0.1] bg-white text-black/75 hover:bg-[#f7f6f3]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
