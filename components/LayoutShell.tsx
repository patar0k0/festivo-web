"use client";

import { usePathname } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function LayoutShell({
  children,
  forceChrome = false,
  userEmail,
}: {
  children: React.ReactNode;
  forceChrome?: boolean;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const isComingSoon = pathname === "/coming-soon";
  const isHome = pathname === "/";
  const isAdmin = pathname.startsWith("/admin");

  if (!forceChrome && (isComingSoon || isHome || isAdmin)) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader userEmail={userEmail} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
