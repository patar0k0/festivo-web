import ConditionalSiteChrome from "@/components/ConditionalSiteChrome";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
  forceChrome?: boolean;
}) {
  return <ConditionalSiteChrome>{children}</ConditionalSiteChrome>;
}
