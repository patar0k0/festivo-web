import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminUserDetailActions from "@/components/admin/AdminUserDetailActions";
import { fetchAdminUserDetail, isAuthUserId, userIsBanned } from "@/lib/admin/adminUserDetail";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  google: {
    label: "Google",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
  apple: {
    label: "Apple",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
  email: {
    label: "Имейл",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  },
};

const MEMBER_STATUS: Record<string, { text: string; className: string }> = {
  active: { text: "Активен", className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90" },
  pending: { text: "Чакащ", className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90" },
  revoked: { text: "Оттеглен", className: "bg-slate-100 text-slate-800 ring-1 ring-slate-200/90" },
};

const ORG_ROLE_LABEL: Record<string, string> = {
  owner: "Собственик",
  admin: "Админ",
  editor: "Редактор",
};

function providerBadge(provider: string) {
  const key = provider.toLowerCase();
  if (PROVIDER_BADGE[key]) return PROVIDER_BADGE[key];
  return {
    label: provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "—",
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  };
}

function memberStatusBadge(status: string) {
  const s = MEMBER_STATUS[status] ?? {
    text: status,
    className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
  };
  return s;
}

function orgRoleLabel(role: string) {
  return ORG_ROLE_LABEL[role] ?? role;
}

const card =
  "rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=${encodeURIComponent(`/admin/users/${id}`)}`);
  }

  if (!isAuthUserId(id)) {
    notFound();
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/users/[id]/page] Admin client initialization failed", { message, id });
    return (
      <div className={`${card} text-sm text-[#b13a1a]`}>
        Данните за потребителя са временно недостъпни.
      </div>
    );
  }

  let detail;
  try {
    detail = await fetchAdminUserDetail(adminClient, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/users/[id]/page] load failed", { message, id });
    return <div className={`${card} text-sm text-[#b13a1a]`}>Грешка при зареждане: {message}</div>;
  }

  if (!detail) {
    notFound();
  }

  const prov = providerBadge(detail.provider);
  const banned = userIsBanned({ banned_until: detail.banned_until });
  const hasActiveOrganizer = detail.organizer_memberships.some((m) => m.status === "active");
  const metaJson =
    Object.keys(detail.user_metadata).length === 0 ? null : JSON.stringify(detail.user_metadata, null, 2);

  return (
    <div className="space-y-4">
      <section className={card}>
        <Link
          href="/admin/users"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] underline underline-offset-2"
        >
          ← Към потребителите
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight">Потребител</h1>
        <p className="mt-0.5 break-all font-mono text-xs text-black/50">{detail.id}</p>
        <h2 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Акаунт</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Имейл</dt>
            <dd className="mt-0.5 font-semibold text-[#0c0e14]">{detail.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Provider</dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${prov.className}`}
              >
                {prov.label}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Регистриран</dt>
            <dd className="mt-0.5 text-black/75">{new Date(detail.created_at).toLocaleString("bg-BG")}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Последен вход</dt>
            <dd className="mt-0.5 text-black/75">
              {detail.last_sign_in_at ? new Date(detail.last_sign_in_at).toLocaleString("bg-BG") : "Никога"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Имейл потвърден</dt>
            <dd className="mt-0.5 text-black/75">
              {detail.email_confirmed_at ? (
                <>
                  Да · {new Date(detail.email_confirmed_at).toLocaleString("bg-BG")}
                </>
              ) : (
                "Не"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">Блокиране</dt>
            <dd className="mt-0.5 text-black/75">
              {banned && detail.banned_until ? (
                <>Активно до {new Date(detail.banned_until).toLocaleString("bg-BG")}</>
              ) : (
                "Не е блокиран"
              )}
            </dd>
          </div>
          {metaJson ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/45">User metadata</dt>
              <dd className="mt-1 max-h-40 overflow-auto rounded-lg border border-black/[0.08] bg-black/[0.02] p-2 font-mono text-xs text-black/70">
                {metaJson}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Роли и достъп</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.is_admin ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-violet-100 text-violet-950 ring-1 ring-violet-200/90">
              Администратор: да
            </span>
          ) : (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-black/[0.04] text-black/60 ring-1 ring-black/[0.08]">
              Администратор: не
            </span>
          )}
          {hasActiveOrganizer ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90">
              Портал организатор: да
            </span>
          ) : (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-black/[0.04] text-black/60 ring-1 ring-black/[0.08]">
              Портал организатор: не
            </span>
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Организаторски връзки</h2>
        {detail.organizer_memberships.length === 0 ? (
          <p className="mt-3 text-sm text-black/60">Няма организаторски връзки</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08]">
            <table className="min-w-full text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.12em] text-black/55">
                <tr>
                  <th className="px-3 py-2">Организатор</th>
                  <th className="px-3 py-2">Роля</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Присъединен</th>
                  <th className="px-3 py-2">Контакт (вериф.)</th>
                </tr>
              </thead>
              <tbody>
                {detail.organizer_memberships.map((m) => {
                  const st = memberStatusBadge(m.status);
                  return (
                    <tr key={m.id} className="border-t border-black/[0.06]">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/organizers/${m.organizer_id}/edit`}
                          className="font-semibold text-[#0c0e14] underline-offset-2 hover:underline"
                        >
                          {m.organizer_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-black/75">{orgRoleLabel(m.role)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${st.className}`}
                        >
                          {st.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-black/70">
                        {m.created_at ? new Date(m.created_at).toLocaleString("bg-BG") : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-black/65">
                        <div className="break-all">{m.contact_email?.trim() || "—"}</div>
                        <div className="mt-0.5">{m.contact_phone?.trim() || "—"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Активност</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-black/75">
          <li>Запазени фестивали: {detail.plan_festivals_count}</li>
          <li>Напомняния: {detail.plan_reminders_count}</li>
          <li>Push известия изпратени: {detail.notifications_count}</li>
        </ul>
        <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Устройства</h3>
        {detail.device_tokens.length === 0 ? (
          <p className="mt-2 text-sm text-black/55">Няма регистрирани устройства</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {detail.device_tokens.map((t, i) => {
              const active = !t.invalidated_at;
              return (
                <li
                  key={`${t.platform ?? "x"}-${t.created_at ?? i}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-black/[0.05] pt-1.5 first:border-t-0 first:pt-0"
                >
                  <span className="font-medium capitalize text-[#0c0e14]">{t.platform ?? "—"}</span>
                  <span className="text-black/60">
                    регистрирано: {t.created_at ? new Date(t.created_at).toLocaleString("bg-BG") : "—"}
                  </span>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                      active
                        ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90"
                        : "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
                    }`}
                  >
                    {active ? "Активно" : "Невалидно"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Админ действия</h2>
        <div className="mt-3">
          <AdminUserDetailActions
            userId={detail.id}
            banned={banned}
            isAdmin={detail.is_admin}
            currentAdminUserId={ctx.user.id}
          />
        </div>
      </section>
    </div>
  );
}
