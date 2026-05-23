"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ORGANIZER_PORTAL_LINKS_NON_OWNER,
  ORGANIZER_PORTAL_LINKS_OWNER,
} from "@/lib/organizer/portalNavConfig";
import { cn } from "@/lib/utils";

function linkActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  // Dashboard is matched only exactly — otherwise "/organizer/..." would all
  // light up Табло too. All other items match prefix (e.g. /submissions/:id
  // should still highlight Моите подавания).
  if (h === "/organizer/dashboard") {
    return n === h;
  }
  return n === h || n.startsWith(`${h}/`);
}

/** Organizer workspace sidebar. Links depend on active owner membership. */
export default function OrganizerSidebarNav({
  isOrganizerOwner,
  hasSubmissions,
}: {
  isOrganizerOwner: boolean;
  hasSubmissions: boolean;
}) {
  const pathname = usePathname();
  const links = isOrganizerOwner ? ORGANIZER_PORTAL_LINKS_OWNER : ORGANIZER_PORTAL_LINKS_NON_OWNER;

  return (
    <nav aria-label="Зона за организатори" className="flex flex-col gap-4">
      {/* ── Primary nav ─ */}
      <div className="flex flex-wrap gap-2 md:flex-col md:gap-1.5">
        {links.map((item) => {
          const active = linkActive(pathname, item.href);
          const isNewFestivalItem = item.href === "/organizer/festivals/new";
          // Onboarding nudge — when the user has no submissions yet, the
          // "Add festival" item gets the primary brand treatment so it's
          // the obvious next step. Once they have any submission, it
          // becomes a regular nav row again.
          const primaryNewFestival = isNewFestivalItem && !hasSubmissions;

          const variantClass = primaryNewFestival
            ? "border-[#7c2d12]/90 bg-[#7c2d12] text-white shadow-sm hover:bg-[#5c200d]"
            : active
              ? "border-amber-200/70 bg-amber-50/70 text-[#5c200d] ring-1 ring-amber-100/50"
              : "border-transparent bg-transparent text-black/65 hover:bg-black/[0.04] hover:text-[#0c0e14]";

          const iconClass = primaryNewFestival
            ? "text-white"
            : active
              ? "text-[#7c2d12]"
              : "text-black/45";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 md:w-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25",
                variantClass,
              )}
            >
              {item.icon ? (
                <span
                  className={cn("text-base leading-none", iconClass)}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
              {active && !primaryNewFestival ? (
                <span aria-hidden="true" className="ml-auto text-xs text-[#7c2d12]">
                  •
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* ── Secondary (desktop only) ─ */}
      <div className="hidden border-t border-black/[0.06] pt-4 md:block">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
          Помощ
        </p>
        <a
          href="mailto:admin@festivo.bg"
          className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-black/55 transition hover:bg-black/[0.04] hover:text-[#0c0e14]"
        >
          <span aria-hidden="true">✉️</span>
          <span className="truncate">admin@festivo.bg</span>
        </a>
      </div>
    </nav>
  );
}
