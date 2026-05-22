import { format } from "date-fns";
import { bg } from "date-fns/locale";

type Props = {
  displayName: string | null;
  email: string | null;
  createdAt: string | null;
};

function firstNameFrom(displayName: string | null): string | null {
  if (!displayName) return null;
  const first = displayName.split(/\s+/)[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function fallbackGreetingFromEmail(email: string | null): string {
  if (!email) return "Здравей!";
  const local = email.split("@")[0] ?? "";
  // Try to extract a humanish first name from local-part (e.g. "ivan.petrov" → "Иван")
  const cleaned = local.replace(/[^\p{L}\p{N}]/gu, " ").trim();
  const first = cleaned.split(/\s+/)[0];
  if (!first || first.length < 2) return "Здравей!";
  const capitalized = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return `Здравей, ${capitalized}!`;
}

export default function ProfileGreeting({ displayName, email, createdAt }: Props) {
  const firstName = firstNameFrom(displayName);
  const greeting = firstName
    ? `Здравей, ${firstName}!`
    : fallbackGreetingFromEmail(email);

  const memberSince = createdAt ? formatMemberSince(createdAt) : null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
        Акаунт
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0c0e14] md:text-3xl">
        {greeting}
      </h1>
      {memberSince ? (
        <p className="mt-1.5 text-sm text-black/55">Член от {memberSince}</p>
      ) : null}
    </div>
  );
}

function formatMemberSince(iso: string): string | null {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, "LLLL yyyy", { locale: bg });
  } catch {
    return null;
  }
}
