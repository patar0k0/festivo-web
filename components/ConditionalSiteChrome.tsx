"use client";

import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  /** Рендерира се на сървъра — не импортирай SiteHeader в този файл. */
  header: React.ReactNode;
  /** Рендерира се на сървъра */
  footer: React.ReactNode;
  /** Без публичен хедър/футър (coming soon, превю на целия сайт с cookie и т.н.). */
  minimalChrome?: boolean;
};

/**
 * Routes that render their own internal workspace chrome (WorkspaceShell with
 * top bar + sidebar). Public SiteHeader/SiteFooter would just duplicate
 * navigation and steal vertical real estate, so we suppress them.
 *
 * Matches the route groups under app/:
 *   - /admin/*                       (AdminShell)
 *   - /organizer/dashboard           \
 *   - /organizer/submissions/*       } organizer (workspace) route group
 *   - /organizer/festivals/*         /
 *   - /organizer/organizations/*    (edit organizer profile — workspace, not marketing)
 *
 * NOTE: Other /organizer routes intentionally KEEP public chrome:
 *   - /organizer            (marketing landing)
 *   - /organizer/benefits   (info page)
 *   - /organizer/claim      (onboarding for non-owners)
 *   - /organizer/profile/new (onboarding for non-owners)
 */
function isInternalWorkspaceRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/organizer/dashboard" || pathname.startsWith("/organizer/dashboard/")) return true;
  if (pathname === "/organizer/submissions" || pathname.startsWith("/organizer/submissions/")) return true;
  if (pathname === "/organizer/festivals" || pathname.startsWith("/organizer/festivals/")) return true;
  if (pathname === "/organizer/organizations" || pathname.startsWith("/organizer/organizations/")) return true;
  return false;
}

/**
 * Internal workspaces (admin + organizer dashboard) hide the public chrome to
 * avoid double navigation. The page renders its own WorkspaceShell with
 * topbar + sidebar; the public SiteHeader/SiteFooter would be redundant.
 * Header is passed in from a server parent so next/headers stays out of the
 * client bundle.
 */
export default function ConditionalSiteChrome({ children, header, footer, minimalChrome }: Props) {
  const pathname = usePathname();
  const isWorkspaceRoute = isInternalWorkspaceRoute(pathname);

  if (minimalChrome || isWorkspaceRoute) {
    return (
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#7c2d12] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Към съдържанието
      </a>
      {header}
      <main id="main-content">{children}</main>
      {footer}
    </>
  );
}
