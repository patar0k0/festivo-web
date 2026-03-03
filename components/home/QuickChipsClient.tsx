"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type QuickChipsClientProps = {
  chips: Array<{ label: string; href: string }>;
};

function isChipActive(href: string, pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const parsedHref = new URL(href, "https://festivo.local");
  const chipParams = parsedHref.searchParams;

  if (!chipParams.toString()) {
    return false;
  }

  const targetPath = parsedHref.pathname === "/" ? pathname : parsedHref.pathname;
  if (targetPath !== pathname) {
    return false;
  }

  return Array.from(chipParams.entries()).every(([key, value]) => searchParams.get(key) === value);
}

function chipClassName(active: boolean) {
  return [
    "whitespace-nowrap md:whitespace-normal snap-start rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
    active
      ? "border-[#0c0e14]/30 bg-[#0c0e14]/12 text-[#0c0e14]"
      : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white",
  ].join(" ");
}

export default function QuickChipsClient({ chips }: QuickChipsClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
      {chips.map((chip) => (
        <Link key={`${chip.label}-${chip.href}`} href={chip.href} className={chipClassName(isChipActive(chip.href, pathname, searchParams))}>
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
