import Link from "next/link";

const containerClass =
  "mx-auto flex h-[60px] w-full max-w-[1180px] items-center justify-between gap-4 px-[18px]";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-[#f5f4f0]/85 backdrop-blur-xl">
      <div className={containerClass}>
        {/* Logo */}
        <Link href="#" className="flex items-center gap-2.5 font-black tracking-tight text-[#0c0e14] no-underline">
          <span
            className="flex h-[32px] w-[32px] items-center justify-center rounded-[10px] bg-[#0c0e14] text-white text-[14px]"
            aria-hidden="true"
          >
            🎪
          </span>
          <span>Festivo.bg</span>
        </Link>

        {/* Nav */}
        <nav aria-label="Навигация" className="max-[980px]:hidden">
          <ul className="flex items-center gap-1 text-sm font-bold text-black/60 list-none">
            {[
              { href: "#radar", label: "Radar" },
              { href: "#trails", label: "Trails" },
              { href: "#plan", label: "План" },
              { href: "#app", label: "Приложение" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-xl px-3 py-2 transition hover:bg-black/[0.06] hover:text-black"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-[38px] items-center gap-2 rounded-[14px] border border-black/[0.1] bg-white px-4 text-sm font-bold shadow-[0_2px_0_rgba(12,14,20,0.06),0_8px_20px_rgba(12,14,20,0.06)] transition hover:-translate-y-px hover:border-black/20"
          >
            Добави фестивал
          </button>
          <Link
            href="/festival/demo"
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[14px] bg-[#0c0e14] px-4 text-sm font-extrabold text-white transition hover:bg-[#1e2030] hover:-translate-y-px"
          >
            Пример детайл →
          </Link>
        </div>
      </div>
    </header>
  );
}
