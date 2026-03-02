"use client";

import { usePathname } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function LayoutShell({
  children,
  forceChrome = false,
}: {
  children: React.ReactNode;
  forceChrome?: boolean;
}) {
  const pathname = usePathname();
  const isComingSoon = pathname === "/coming-soon";
  const isHome = pathname === "/";

  if (!forceChrome && (isComingSoon || isHome)) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
