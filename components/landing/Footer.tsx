import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-4 border-t border-black/10 py-6 text-black/60">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-start justify-between gap-3.5 px-[18px]">
        <div className="max-w-[70ch]">
          <div className="mb-2 flex items-center gap-2.5 font-black tracking-tight text-black">
            <span className="h-[34px] w-[34px] rounded-[12px] border border-white/70 bg-gradient-to-br from-violet-600/95 to-cyan-500/95 shadow-[0_14px_30px_rgba(124,58,237,0.18)]" aria-hidden="true" />
            <span>Festivo.bg</span>
          </div>
          <div className="text-xs">Само безплатни фестивали. Radar -> План -> Напомняне.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="#radar"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]"
          >
            Radar
          </Link>
          <Link
            href="#trails"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]"
          >
            Trails
          </Link>
          <Link
            href="#plan"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]"
          >
            План
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]">
            © 2026
          </span>
        </div>
      </div>
    </footer>
  );
}
