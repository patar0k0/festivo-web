import Link from "next/link";
import Container from "@/components/ui/Container";

export default function SiteHeader() {
  return (
    <header className="border-b border-ink/10 bg-white">
      <Container>
        <div className="grid min-h-[60px] grid-cols-[auto_1fr_auto] items-center gap-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-ink">
            Festivo
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          </Link>

          <form action="/festivals" className="hidden w-full md:block">
            <input
              type="search"
              name="q"
              placeholder="Търси фестивали…"
              className="w-full rounded-full border border-ink/10 bg-white px-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </form>

          <nav className="flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <Link href="/" className="hidden sm:inline">
              Home
            </Link>
            <Link href="/festivals">Browse</Link>
            <Link href="/map">Explore</Link>
            <Link href="/calendar" className="hidden md:inline">
              Calendar
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
