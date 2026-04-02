"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, adminNavActive } from "@/lib/admin/adminNavConfig";

/**
 * Left-rail section navigation (admin, compact density). Same destinations as legacy horizontal nav.
 */
export default function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Админ навигация"
      className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap md:gap-1"
    >
      {ADMIN_NAV_ITEMS.map((item) => {
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
    </nav>
  );
}
