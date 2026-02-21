import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-ink/5 bg-white/70 backdrop-blur-lg", className)}>
      <div className="container-page flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          <span className="font-[var(--font-display)] text-2xl">Festivo</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold uppercase tracking-widest text-muted">
          <Link href="/festivals">Festivals</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/map">Map</Link>
        </nav>
      </div>
    </header>
  );
}
