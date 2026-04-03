import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OrganizerMemberApproveButton from "@/components/admin/OrganizerMemberApproveButton";
import OrganizerMemberRejectButton from "@/components/admin/OrganizerMemberRejectButton";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function AdminOrganizerClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=${encodeURIComponent(`/admin/organizer-claims/${id}`)}`);
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Услугата е временно недостъпна.</div>;
  }

  const { data, error } = await admin
    .from("organizer_members")
    .select("id,created_at,role,user_id,status,contact_email,contact_phone,organizer:organizers(name,slug)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  const org = data.organizer as { name?: string | null; slug?: string | null } | null;
  const isPending = data.status === "pending";

  return (
    <div className="space-y-6 px-4 py-8 text-[#0c0e14] md:px-8">
      <div>
        <Link href="/admin/organizer-claims" className="text-sm font-semibold text-[#0c0e14] underline">
          ← Към заявките
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-black/45">Админ</p>
        <h1 className="mt-1 text-2xl font-bold">Заявка за профил</h1>
      </div>

      <div className="max-w-2xl space-y-6 rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-sm md:p-8">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Организатор</h2>
          <p className="text-lg font-semibold">{org?.name ?? "—"}</p>
          {org?.slug ? (
            <p className="text-sm text-black/55">
              <Link href={`/organizers/${org.slug}`} className="underline">
                /organizers/{org.slug}
              </Link>
            </p>
          ) : null}
        </section>

        <section className="space-y-2 border-t border-black/[0.06] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Потребител (ID)</h2>
          <p className="break-all font-mono text-sm text-black/75">{data.user_id}</p>
        </section>

        <section className="space-y-3 border-t border-black/[0.06] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Контакт за верификация</h2>
          <div>
            <p className="text-xs font-medium text-black/50">Имейл за връзка</p>
            <p className="mt-1 break-all text-sm font-medium">{data.contact_email?.trim() || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-black/50">Телефон за връзка</p>
            <p className="mt-1 text-sm font-medium">{data.contact_phone?.trim() || "—"}</p>
          </div>
        </section>

        <section className="space-y-2 border-t border-black/[0.06] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Статус</h2>
          <p className="text-sm">
            <span className="font-medium">{data.status}</span>
            {data.role ? <span className="text-black/55"> · {data.role}</span> : null}
          </p>
          <p className="text-xs text-black/50">
            Подадена: {data.created_at ? new Date(data.created_at).toLocaleString("bg-BG") : "—"}
          </p>
        </section>

        {isPending ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-6">
            <OrganizerMemberApproveButton memberId={data.id} />
            <OrganizerMemberRejectButton memberId={data.id} />
          </div>
        ) : (
          <p className="border-t border-black/[0.06] pt-6 text-sm text-black/55">Тази заявка вече не е в състояние „чакаща“.</p>
        )}
      </div>
    </div>
  );
}
