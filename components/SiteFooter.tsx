import Link from "next/link";
import Container from "@/components/ui/Container";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

const sectionTitleClass =
  "text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14]";

const linkClass = cn(
  "block cursor-pointer rounded-lg py-1.5 text-sm font-medium text-[#0c0e14]/78 transition-colors",
  "hover:text-[#0c0e14] hover:underline hover:decoration-black/35 hover:underline-offset-[3px]",
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
    { href: "#", label: "Добави фестивал" },
    { href: "#", label: "Ресурси за организатори" },
    { href: "#", label: "Контакт" },
  ];

  const legalLinks = [
    { href: "#", label: "Политика за поверителност" },
    { href: "#", label: "Политика за бисквитки" },
    { href: "#", label: "Общи условия" },
  ];

  const socialLinks = [
    { href: "#", label: "Facebook", icon: "FB" },
    { href: "#", label: "Instagram", icon: "IG" },
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
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center text-[#0c0e14] no-underline"
            >
              <img
                src="/brand/festivo-logo-web.svg"
                alt="Festivo"
                width={512}
                height={128}
                className="h-9 w-auto max-w-[min(100%,240px)]"
                decoding="async"
              />
            </Link>
            <div className="mt-5 space-y-3.5">
              <p className="text-[15px] font-medium leading-[1.55] text-[#0c0e14] md:text-base md:leading-[1.55]">
                Открий фестивали в България по град, дата и интерес.
              </p>
              <p className={cn(pub.bodySm, "max-w-[40ch] leading-relaxed")}>
                Проверявай детайлите при организатора.
              </p>
              <div className="flex flex-wrap gap-2 pt-1" aria-label="Социални мрежи">
                {socialLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      pub.chipSm,
                      pub.focusRing,
                      "inline-flex min-h-9 min-w-[2.75rem] items-center justify-center no-underline",
                    )}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-4 lg:gap-x-10">
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

        <div className="mt-12 border-t border-black/[0.06] pt-6">
          <p className="text-[11px] leading-relaxed text-black/38">
            © {year} Festivo. Всички права запазени.
          </p>
        </div>
      </Container>
    </footer>
  );
}
