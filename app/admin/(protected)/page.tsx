import Link from "next/link";
import { getAdminContext } from "@/lib/admin/isAdmin";

type FestivalStatus = "draft" | "verified" | "rejected" | "archived";

async function getStatusCount(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null,
  status: FestivalStatus
) {
  if (!supabase) return 0;
  const { count } = await supabase.from("festivals").select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}

async function getPendingCount(supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"] | null) {
  if (!supabase) return 0;
  const { count } = await supabase.from("pending_festivals").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  const supabase = admin?.supabase ?? null;

  const [pending, draft, verified, rejected, archived] = await Promise.all([
    getPendingCount(supabase),
    getStatusCount(supabase, "draft"),
    getStatusCount(supabase, "verified"),
    getStatusCount(supabase, "rejected"),
    getStatusCount(supabase, "archived"),
  ]);

  const festivalStats = [
    { label: "Чернова", value: draft, href: "/admin/festivals?status=draft", hint: "фестивали" },
    { label: "Потвърдени", value: verified, href: "/admin/festivals?status=verified", hint: "фестивали" },
    { label: "Отхвърлени", value: rejected, href: "/admin/festivals?status=rejected", hint: "фестивали" },
    { label: "Архивирани", value: archived, href: "/admin/festivals?status=archived", hint: "фестивали" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(16rem,22rem)] lg:items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Админ табло</h1>
            <p className="mt-2 max-w-xl text-sm text-black/65">
              Преглед на статусите, бърз достъп до чакащи записи и чести действия.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/festivals"
                className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#1d202b]"
              >
                Към фестивали
              </Link>
              <Link
                href="/admin/pending-festivals"
                className="rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-black/[0.03]"
              >
                Чакащи за одобрение
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Бързи действия</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/admin/pending-festivals" className="font-medium text-[#0c0e14] hover:underline">
                  Преглед на чакащи фестивали
                </Link>
              </li>
              <li>
                <Link href="/admin/research" className="font-medium text-[#0c0e14] hover:underline">
                  Проучване на фестивал (AI)
                </Link>
              </li>
              <li>
                <Link href="/admin/organizers/research" className="font-medium text-[#0c0e14] hover:underline">
                  Нов организатор (AI)
                </Link>
              </li>
              <li>
                <Link href="/admin/ingest" className="font-medium text-[#0c0e14] hover:underline">
                  Внасяне на данни
                </Link>
              </li>
              <li>
                <Link href="/admin/discovery" className="font-medium text-[#0c0e14] hover:underline">
                  Открития
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/admin/pending-festivals"
          className={`rounded-2xl border p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)] transition-colors hover:border-[#c9a227]/40 hover:bg-[#fffbeb] ${
            pending > 0 ? "border-[#d4a017]/35 bg-[#fffbeb]/80" : "border-black/[0.08] bg-white/85"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Чакащи</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{pending}</p>
          <p className="mt-1 text-xs text-black/50">Натисни за списък →</p>
        </Link>

        {festivalStats.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)] transition-colors hover:border-black/[0.14] hover:bg-white"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">{item.label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{item.value}</p>
            <p className="mt-1 text-xs text-black/50">{item.hint} · филтър →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
