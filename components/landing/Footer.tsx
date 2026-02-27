import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-4 border-t border-black/[0.08] py-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-[18px]">
        {/* Brand */}
        <div className="flex flex-col gap-1.5">
          <Link href="#" className="flex items-center gap-2.5 font-black tracking-tight text-[#0c0e14] no-underline">
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#0c0e14] text-[13px] text-white"
              aria-hidden="true"
            >
              🎪
            </span>
            Festivo.bg
          </Link>
          <p className="text-[12px] text-black/40">
            Само безплатни фестивали. Radar → План → Напомняне.
          </p>
        </div>

        {/* Links */}
        <nav aria-label="Footer навигация">
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { href: "#radar", label: "Radar" },
              { href: "#trails", label: "Trails" },
              { href: "#plan", label: "План" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-black/40 transition hover:bg-black/[0.06] hover:text-black/70"
              >
                {label}
              </Link>
            ))}
            <span className="px-2.5 py-1.5 text-[12px] text-black/25">© 2026</span>
          </div>
        </nav>
      </div>
    </footer>
  );
}
