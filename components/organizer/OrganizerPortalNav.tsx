import Link from "next/link";

const links: { href: string; label: string }[] = [
  { href: "/organizer/dashboard", label: "Табло" },
  { href: "/organizer/profile/new", label: "Нов профил" },
  { href: "/organizer/claim", label: "Заявка за профил" },
  { href: "/organizer/festivals/new", label: "Ново подаване" },
  { href: "/organizer/submissions", label: "Моите подавания" },
];

export default function OrganizerPortalNav() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-black/[0.08] pb-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[#0c0e14] transition hover:bg-black/[0.04]"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
