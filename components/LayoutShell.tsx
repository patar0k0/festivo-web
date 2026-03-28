import { cookies, headers } from "next/headers";
import ConditionalSiteChrome from "@/components/ConditionalSiteChrome";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-festivo-pathname") ?? "";
  const hasPreviewAccess = Boolean(cookies().get("festivo_preview")?.value);
  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const minimalChrome =
    pathname === "/coming-soon" || (pathname === "/" && comingSoonMode && !hasPreviewAccess);

  return (
    <ConditionalSiteChrome
      minimalChrome={minimalChrome}
      header={<SiteHeader />}
      footer={<SiteFooter />}
    >
      {children}
    </ConditionalSiteChrome>
  );
}
