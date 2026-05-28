import Image from "next/image";
import Link from "next/link";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

const sectionTitleClass =
  "text-xs font-medium uppercase tracking-[0.14em] text-black/60";

const linkClass = cn(
  "block cursor-pointer rounded-lg py-1.5 text-sm font-medium text-black/70 transition-all duration-150",
  "hover:text-black/85 hover:underline hover:decoration-black/25 hover:underline-offset-[3px] active:scale-[0.99]",
  pub.focusRing,
);

export default function SiteFooter() {
  const discoverLinks = [
    { href: "/festivals", label: "Фестивали" },
    { href: "/map", label: "Карта" },
    { href: "/calendar", label: "Календар" },
  ];

  const accountLinks = [
    { href: "/plan", label: "План" },
    { href: "/profile", label: "Профил" },
  ];

  const organizerLinks = [
    { href: "/organizer/festivals/new", label: "Добави фестивал" },
    { href: "#", label: "Ресурси за организатори" },
  ];

  const contactHref = "/contact";

  const legalLinks = [
    { href: "/privacy", label: "Политика за поверителност" },
    { href: "/cookies", label: "Политика за бисквитки" },
    { href: "/terms", label: "Общи условия" },
    { href: "/terms-organizers", label: "Условия за организатори" },
  ];

  const socialLinks = [
    {
      href: "https://www.facebook.com/festivo.bg",
      label: "Facebook",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      ),
    },
    {
      href: "https://www.instagram.com/festivo.bg",
      label: "Instagram",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
  ] as const;

  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        pub.page,
        "border-t border-amber-200/35 bg-transparent",
      )}
    >
      <Container className="py-12 md:py-14">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center text-[#0c0e14] no-underline"
            >
              <Image
                src="/brand/festivo-logo-web.svg"
                alt="Festivo"
                width={512}
                height={128}
                className="h-9 w-auto max-w-[min(100%,240px)]"
              />
            </Link>
            <div className="mt-5 space-y-3.5">
              <p className="text-[15px] font-medium leading-relaxed text-black/85 md:text-base">
                Открий фестивали в България по град, дата и интерес.
              </p>
              <div className="flex flex-wrap gap-2 pt-1" aria-label="Социални мрежи">
                {socialLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      pub.focusRing,
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.12] bg-white text-black/60 no-underline transition-all duration-150 hover:border-black/25 hover:bg-black/[0.04] hover:text-black/85",
                    )}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </Link>
                ))}
              </div>

              <div className="pt-2">
                <NewsletterSignup source="footer" />
              </div>
            </div>
          </div>

          <div className="grid gap-12 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-4 lg:gap-x-14">
            <div>
              <p className={sectionTitleClass}>Открий</p>
              <nav aria-label="Открий" className="mt-4 space-y-0.5">
                {discoverLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>За теб</p>
              <nav aria-label="За теб" className="mt-4 space-y-0.5">
                {accountLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>За организатори</p>
              <nav aria-label="За организатори" className="mt-4 space-y-0.5">
                {organizerLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>Правна информация</p>
              <nav aria-label="Правна информация" className="mt-4 space-y-0.5">
                {legalLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-black/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-[11px] leading-relaxed text-black/65">
            © {year} Festivo. Всички права запазени.
          </p>
          <Link
            href={contactHref}
            className={cn(
              "text-[11px] font-medium leading-relaxed text-black/55 no-underline transition-all duration-150",
              "hover:text-black/75 hover:underline hover:decoration-black/25 hover:underline-offset-[3px] active:scale-[0.99]",
              pub.focusRing,
              "rounded-sm",
            )}
          >
            Контакт
          </Link>
        </div>
      </Container>
    </footer>
  );
}
