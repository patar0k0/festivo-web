"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_GROUPS, adminNavActive } from "@/lib/admin/adminNavConfig";

/**
 * Left-rail section navigation (admin, compact density). Same destinations as legacy horizontal nav.
 */
export default function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Админ навигация"
      className="flex flex-col gap-3"
    >
      {ADMIN_NAV_GROUPS.map((group) => {
        return (
          <div key={group.label} className="space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap md:gap-1">
              {group.items.map((item) => {
                const active = adminNavActive(pathname, item.href, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors md:w-full md:px-2.5 md:py-2 ${
                      active
                        ? "border-black/[0.18] bg-black/[0.07] text-[#0c0e14]"
                        : "border-black/[0.1] bg-white text-black/80 hover:bg-[#f7f6f3]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
