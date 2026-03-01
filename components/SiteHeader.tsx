import Link from "next/link";
import Container from "@/components/ui/Container";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-[#f5f4f0]/90 backdrop-blur-xl">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#0c0e14]">
          <span className="font-[var(--font-display)] text-2xl">Festivo</span>
        </Link>
        <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-black/55">
          <Link href="/festivals" className="transition hover:text-[#0c0e14]">
            Фестивали
          </Link>
          <Link href="/calendar" className="transition hover:text-[#0c0e14]">
            Календар
          </Link>
          <Link href="/map" className="transition hover:text-[#0c0e14]">
            Карта
          </Link>
        </nav>
      </Container>
    </header>
  );
}
