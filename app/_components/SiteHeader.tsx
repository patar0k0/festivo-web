import Link from "next/link";
import AppleButton from "@/components/apple/AppleButton";
import ApplePill from "@/components/apple/ApplePill";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b" style={{ borderColor: "var(--border2)" }}>
      <div className="bg-[rgba(245,245,247,.78)] backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold">
            <span className="h-8 w-8 rounded-xl bg-black/90" aria-hidden="true" />
            Festivo
          </Link>

          <div className="hidden lg:flex items-center gap-2 rounded-full border apple-border bg-[var(--surface)] p-1 text-xs font-semibold">
            <ApplePill active href="/festivals">
              Feed
            </ApplePill>
            <ApplePill href="/calendar">Calendar</ApplePill>
            <ApplePill href="/map">Map</ApplePill>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <AppleButton>Филтри</AppleButton>
            <AppleButton variant="primary">Моят план</AppleButton>
            <AppleButton variant="ghost" className="text-muted">
              Вход
            </AppleButton>
          </div>
        </div>
      </div>
    </header>
  );
}
