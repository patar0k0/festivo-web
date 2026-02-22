import Link from "next/link";
import Container from "@/components/ui/Container";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-sand/80 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          <span className="font-[var(--font-display)] text-2xl">Festivo</span>
        </Link>
        <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          <Link href="/festivals">Festivals</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/map">Map</Link>
        </nav>
      </Container>
    </header>
  );
}
