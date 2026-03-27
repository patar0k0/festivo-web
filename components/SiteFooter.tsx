import Link from "next/link";
import Container from "@/components/ui/Container";

export default function SiteFooter() {
  const exploreLinks = [
    { href: "/festivals", label: "Фестивали" },
    { href: "/map", label: "Карта" },
    { href: "/calendar", label: "Календар" },
    { href: "/city", label: "Градове" },
  ];

  const legalLinks = [
    { href: "/privacy", label: "Политика за поверителност" },
    { href: "/cookies", label: "Политика за бисквитки" },
  ];

  return (
    <footer className="border-t border-ink/10 bg-white text-sm text-muted">
      <Container className="py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          <div className="space-y-2">
            <p className="font-display text-base text-ink">Festivo</p>
            <p className="text-sm">Открий фестивали в България</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/80">Разгледай</p>
            <nav aria-label="Разгледай">
              <ul className="space-y-2">
                {exploreLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/80">Правна информация</p>
            <nav aria-label="Правна информация">
              <ul className="space-y-2">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-8 space-y-2 border-t border-ink/10 pt-4 text-xs leading-relaxed">
          <p className="text-ink/80">© 2026 Festivo</p>
          <p>Festivo обединява събития от организатори и публични източници.</p>
          <p>Препоръчваме да провериш информацията при официалния организатор.</p>
        </div>
      </Container>
    </footer>
  );
}
