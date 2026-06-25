import Link from "next/link";

type CardProps = {
  href: string;
  title: string;
  count: number;
  noun: { one: string; few: string; many: string };
  icon: string;
  emptyCta: string;
};

function pluralize(count: number, noun: CardProps["noun"]): string {
  if (count === 1) return noun.one;
  // Bulgarian plural: 2-4 use "few" form, 0/5+ use "many" form. Festivals don't have
  // a paucal-quadral split (it's "2 фестивала", "5 фестивала"), but cities follow it
  // ("2 града" vs "5 града"). Use few=many fallback when caller passes same value.
  if (count >= 2 && count <= 4) return noun.few;
  return noun.many;
}

function QuickLinkCard({ href, title, count, noun, icon, emptyCta }: CardProps) {
  const isEmpty = count === 0;
  const subtitle = isEmpty ? emptyCta : `${count} ${pluralize(count, noun)}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-black/[0.08] bg-white/95 p-4 transition-all duration-150 hover:border-black/[0.15] hover:bg-white hover:shadow-[0_2px_0_rgba(12,14,20,0.04),0_8px_20px_rgba(12,14,20,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fef3e2] text-2xl"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0c0e14]">{title}</p>
        <p
          className={
            isEmpty
              ? "mt-0.5 text-xs text-black/50"
              : "mt-0.5 text-xs font-medium text-[#7c2d12]"
          }
        >
          {subtitle}
        </p>
      </div>
      <span
        className="shrink-0 text-black/30 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-black/55"
        aria-hidden="true"
      >
        →
      </span>
    </Link>
  );
}

type Props = {
  planCount: number;
  followedCitiesCount: number;
  followedOrganizersCount: number;
};

export default function QuickLinks({
  planCount,
  followedCitiesCount,
  followedOrganizersCount,
}: Props) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-[#0c0e14]">Бързи връзки</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <QuickLinkCard
          href="/plan"
          title="Моят план"
          count={planCount}
          noun={{ one: "фестивал", few: "фестивала", many: "фестивала" }}
          icon="📅"
          emptyCta="Запази първия си фестивал"
        />
        <QuickLinkCard
          href="/profile/follows"
          title="Любими градове"
          count={followedCitiesCount}
          noun={{ one: "град", few: "града", many: "града" }}
          icon="📍"
          emptyCta="Разгледай по градове"
        />
        <QuickLinkCard
          href="/profile/follows"
          title="Любими организатори"
          count={followedOrganizersCount}
          noun={{ one: "организатор", few: "организатора", many: "организатора" }}
          icon="⭐"
          emptyCta="Открий организатори"
        />
      </div>
    </section>
  );
}
