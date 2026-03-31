type Variant = "create" | "claim";

const variantClass: Record<Variant, string> = {
  create:
    "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]",
  claim:
    "border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]",
};

export default function OrganizerOnboardingValueBlock({ variant }: { variant: Variant }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 md:px-5 md:py-4 ${variantClass[variant]}`}>
      <p className="text-sm font-semibold text-[#0c0e14]">С профил във Festivo можете да:</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-snug text-black/75">
        <li className="flex gap-2">
          <span className="text-black/40" aria-hidden>
            •
          </span>
          <span>Управлявате фестивалите си на едно място</span>
        </li>
        <li className="flex gap-2">
          <span className="text-black/40" aria-hidden>
            •
          </span>
          <span>Достигате повече посетители</span>
        </li>
        <li className="flex gap-2">
          <span className="text-black/40" aria-hidden>
            •
          </span>
          <span>Получавате известия и статистики</span>
        </li>
      </ul>
    </div>
  );
}
