"use client";

import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  /** Рендерира се на сървъра — не импортирай SiteHeader в този файл. */
  header: React.ReactNode;
  /** Рендерира се на сървъра */
  footer: React.ReactNode;
};

/**
 * Админ зоната (/admin/*) без публичен хедър/футър — един изход и по-малко шум.
 * Хедърът се подава от сървърен родител, за да не влиза next/headers в client bundle.
 */
export default function ConditionalSiteChrome({ children, header, footer }: Props) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  if (isAdminRoute) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
