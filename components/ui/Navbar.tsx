import Link from "next/link";
import Container from "@/components/ui/Container";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
            Festivo
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-neutral-600">
            <Link href="/festivals" className="transition hover:text-ink">
              Festivals
            </Link>
            <Link href="/map" className="transition hover:text-ink">
              Map
            </Link>
            <Link href="/calendar" className="transition hover:text-ink">
              Calendar
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
