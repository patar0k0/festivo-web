import type { FestivalAccessRole } from "@/lib/organizer/festivalAccess";

type Props = {
  role: FestivalAccessRole;
};

export function FestivalRoleBadge({ role }: Props) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Собственик
      </span>
    );
  }
  if (role === "co_host") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/70 bg-sky-50/90 px-2.5 py-0.5 text-xs font-medium text-sky-900">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Съ-организатор
      </span>
    );
  }
  return null;
}
