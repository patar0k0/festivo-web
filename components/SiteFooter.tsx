import Link from "next/link";
import Container from "@/components/ui/Container";

const sectionTitleClass =
  "text-[11px] font-extrabold uppercase tracking-[0.18em] text-black/45";

const linkClass =
  "block rounded-lg py-1 text-[13px] font-medium text-black/60 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25";

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

  return (
    <footer className="border-t border-black/[0.08] bg-[#f5f4f0]/95 text-[#0c0e14] backdrop-blur-xl">
      <Container className="py-10 md:py-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-black tracking-tight text-[#0c0e14] no-underline"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0c0e14] text-[15px] text-white"
                aria-hidden="true"
              >
                🎪
              </span>
              <span className="font-[var(--font-display)] text-xl tracking-tight">Festivo</span>
            </Link>
            <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-black/55">
              Каталог на фестивали в България — откриване по град, дата и интерес. Проверявай детайлите при
              организатора.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
            <div>
              <p className={sectionTitleClass}>Открий</p>
              <nav aria-label="Открий" className="mt-3 space-y-0.5">
                {discoverLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>За теб</p>
              <nav aria-label="За теб" className="mt-3 space-y-0.5">
                {accountLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>За организатори</p>
              <nav aria-label="За организатори" className="mt-3 space-y-0.5">
                {organizerLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className={sectionTitleClass}>Правна информация</p>
              <nav aria-label="Правна информация" className="mt-3 space-y-0.5">
                {legalLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-black/[0.08] pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-black/45">© {new Date().getFullYear()} Festivo. Всички права запазени.</p>
          <div className="flex items-center gap-2">
            {socialLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-[10px] border border-black/[0.08] bg-white/80 text-[10px] font-extrabold tracking-wider text-black/50 transition hover:border-black/[0.14] hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                aria-label={item.label}
              >
                {item.icon}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
