"use client";

type Props = {
  name: string;
  description: string;
  websiteUrl: string;
  email: string;
};

function placeholder(v: string, fallback: string): string {
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return `${a}${b}`.toUpperCase() || "?";
}

function safeUrlHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProto = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).host;
  } catch {
    return null;
  }
}

export default function OrganizerProfilePreview({ name, description, websiteUrl, email }: Props) {
  const displayName = placeholder(name, "Името на организатора");
  const isPlaceholderName = !name.trim();
  const descBody = placeholder(
    description,
    "Кратко описание на организатора — какво организираш, от кога, в кой регион…",
  );
  const isPlaceholderDesc = !description.trim();
  const host = safeUrlHost(websiteUrl);
  const initials = initialsFromName(name);

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/45 bg-white/95 shadow-sm ring-1 ring-amber-100/35">
      {/* Mini browser chrome — signals "this is what it'll look like" */}
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-[#fafaf8] px-3 py-2">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-400/55" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400/55" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400/55" />
        <p className="ml-3 truncate text-[11px] font-medium text-black/45">
          festivo.bg/organizers/<span className="text-black/30">…</span>
        </p>
      </div>

      <div className="px-5 py-6 md:px-6 md:py-7">
        {/* Top: avatar + name */}
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c2d12] to-[#5c200d] text-xl font-bold text-white shadow-sm"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7c2d12]/70">
              Организатор
            </p>
            <h3
              className={
                isPlaceholderName
                  ? "mt-1 truncate text-lg font-bold text-black/30 md:text-xl"
                  : "mt-1 truncate text-lg font-bold text-[#0c0e14] md:text-xl"
              }
            >
              {displayName}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p
          className={
            isPlaceholderDesc
              ? "mt-5 text-sm leading-relaxed text-black/35"
              : "mt-5 text-sm leading-relaxed text-black/70"
          }
        >
          {descBody}
        </p>

        {/* Contact strip */}
        {host || email.trim() ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-black/[0.05] pt-4">
            {host ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fef3e2] px-2.5 py-1 text-xs font-medium text-[#7c2d12]">
                <span aria-hidden="true">🔗</span>
                <span className="truncate max-w-[220px]">{host}</span>
              </span>
            ) : null}
            {email.trim() ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
                <span aria-hidden="true">✉️</span>
                <span className="truncate max-w-[220px]">{email.trim()}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Future: festivals list placeholder */}
        <div className="mt-6 rounded-xl border border-dashed border-black/10 bg-[#fafaf8] px-4 py-5 text-center">
          <p className="text-xs font-medium text-black/45">Фестивалите на организатора</p>
          <p className="mt-1 text-[11px] text-black/35">
            Появяват се тук, след като ги добавиш и бъдат одобрени
          </p>
        </div>
      </div>
    </div>
  );
}
