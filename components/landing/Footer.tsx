import Link from "next/link";

const sectionTitleClass =
  "text-[11px] font-extrabold uppercase tracking-[0.18em] text-black/45";

const linkClass =
  "block rounded-lg py-1 text-[13px] font-semibold text-black/55 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25";

export default function Footer() {
  const productLinks = [
    { href: "#radar", label: "Radar" },
    { href: "#trails", label: "Trails" },
    { href: "#plan", label: "План" },
    { href: "#app", label: "Приложение" },
  ];

  const extraLinks = [
    { href: "#", label: "За организатори" },
    { href: "#", label: "Помощ" },
  ];

  const legalLinks = [
    { href: "#", label: "Поверителност" },
    { href: "#", label: "Условия" },
  ];

  return (
    <footer className="mt-4 border-t border-black/[0.08] bg-[#f5f4f0]/90 py-10 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1180px] px-[18px]">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5 font-black tracking-tight text-[#0c0e14] no-underline">
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#0c0e14] text-[13px] text-white"
                aria-hidden="true"
              >
                🎪
              </span>
              Festivo.bg
            </Link>
            <p className="mt-3 max-w-[36ch] text-[13px] leading-relaxed text-black/50">
              Само безплатни фестивали. Radar → План → Напомняне.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 md:col-span-7">
            <div>
              <p className={sectionTitleClass}>Продукт</p>
              <nav aria-label="Продукт" className="mt-3 space-y-0.5">
                {productLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <p className={sectionTitleClass}>Още</p>
              <nav aria-label="Още" className="mt-3 space-y-0.5">
                {extraLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <p className={sectionTitleClass}>Правно</p>
              <nav aria-label="Правно" className="mt-3 space-y-0.5">
                {legalLinks.map((item) => (
                  <Link key={item.label} href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-black/[0.08] pt-6 text-[12px] text-black/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Festivo.bg</p>
          <div className="flex gap-2">
            <Link
              href="#"
              className="rounded-lg px-2 py-1 font-semibold text-black/40 transition hover:bg-black/[0.06] hover:text-black/65"
              aria-label="Facebook"
            >
              FB
            </Link>
            <Link
              href="#"
              className="rounded-lg px-2 py-1 font-semibold text-black/40 transition hover:bg-black/[0.06] hover:text-black/65"
              aria-label="Instagram"
            >
              IG
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
