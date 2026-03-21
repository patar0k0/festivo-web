import ConditionalSiteChrome from "@/components/ConditionalSiteChrome";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
  forceChrome?: boolean;
}) {
  return (
    <ConditionalSiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
      {children}
    </ConditionalSiteChrome>
  );
}
