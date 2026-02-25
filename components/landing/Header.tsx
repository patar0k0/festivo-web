import Link from "next/link";

const containerClass = "mx-auto flex h-[66px] w-full max-w-[1180px] items-center justify-between gap-4 px-[18px]";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/60 backdrop-blur-xl">
      <div className={containerClass}>
        <Link href="#" className="flex items-center gap-2.5 font-black tracking-tight">
          <span className="h-[34px] w-[34px] rounded-[12px] border border-white/70 bg-gradient-to-br from-violet-600/95 to-cyan-500/95 shadow-[0_14px_30px_rgba(124,58,237,0.18)]" aria-hidden="true" />
          <span>Festivo.bg</span>
        </Link>

        <nav aria-label="Навигация" className="max-[980px]:hidden">
          <ul className="flex items-center gap-2.5 text-sm font-extrabold text-black/60">
            <li>
              <Link href="#radar" className="rounded-xl px-2.5 py-2 transition hover:bg-black/5 hover:text-black">
                Radar
              </Link>
            </li>
            <li>
              <Link href="#trails" className="rounded-xl px-2.5 py-2 transition hover:bg-black/5 hover:text-black">
                Trails
              </Link>
            </li>
            <li>
              <Link href="#plan" className="rounded-xl px-2.5 py-2 transition hover:bg-black/5 hover:text-black">
                План
              </Link>
            </li>
            <li>
              <Link href="#app" className="rounded-xl px-2.5 py-2 transition hover:bg-black/5 hover:text-black">
                Приложение
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]">
            само FREE
          </span>
          <Link
            href="/festival/demo"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-600 to-cyan-500 px-3.5 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(124,58,237,0.22),0_10px_18px_rgba(6,182,212,0.14)] transition hover:-translate-y-0.5"
          >
            Пример детайл
          </Link>
          <button
            type="button"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90"
          >
            Добави фестивал
          </button>
        </div>
      </div>
    </header>
  );
}
