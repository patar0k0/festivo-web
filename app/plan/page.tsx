import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import PlanPageClient from "@/components/plan/PlanPageClient";
import { PlanStateProvider } from "@/components/plan/PlanStateProvider";
import { ACCESS_AUTH_COOKIE, USER_AUTH_COOKIE, getOptionalUser } from "@/lib/authUser";
import { getPlanEntriesByUser, getPlanStateByUser } from "@/lib/plan/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";
import "../landing.css";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Моят план</h1>
          <p className="mt-3 text-sm text-black/65">Влез, за да управляваш избраните събития и напомняния.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white">
            Вход
          </Link>
        </div>
      </div>
    );
  }

  let isAdmin = false;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_AUTH_COOKIE)?.value ?? cookieStore.get(USER_AUTH_COOKIE)?.value;
  const { url, anon, configured } = getSupabaseEnv();

  if (token && configured && url && anon) {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    isAdmin = Boolean(data);
  }

  const [entries, state] = await Promise.all([getPlanEntriesByUser(user.id), getPlanStateByUser(user.id)]);

  return (
    <PlanStateProvider
      initialScheduleItemIds={state.scheduleItemIds}
      initialReminders={state.reminders}
      isAuthenticated
    >
      <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-10">
        <div className="mx-auto w-full max-w-[1100px] space-y-5">
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
            <h1 className="text-3xl font-black tracking-tight">Моят план</h1>
            <p className="mt-2 text-sm text-black/65">Предстоящи събития и напомняния.</p>
            {isAdmin ? (
              <Link
                href="/admin"
                className="mt-4 inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
              >
                Админ панел
              </Link>
            ) : null}
          </div>

          <PlanPageClient entries={entries} />
        </div>
      </div>
    </PlanStateProvider>
  );
}
