import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import "../../landing.css";
import { UnsubscribeClient } from "./UnsubscribeClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  const token = (params.token ?? "").trim();

  if (!UUID_RE.test(token)) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Невалиден линк</h1>
          <p className="mt-2 text-sm text-black/65">Този адрес не е валиден. Ако копираш линк от имейл, опитай отново.</p>
          <Link href="/" className="mt-5 inline-block text-sm font-semibold text-[#0c0e14] underline">
            Към началото
          </Link>
        </div>
      </div>
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Временно недостъпно</h1>
          <p className="mt-2 text-sm text-black/65">Услугата не е настроена. Опитай по-късно.</p>
        </div>
      </div>
    );
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("user_email_preferences").select("user_id").eq("unsubscribe_token", token).maybeSingle();

  if (error || !data?.user_id) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Линкът не е валиден</h1>
          <p className="mt-2 text-sm text-black/65">
            Не намерихме настройки за този линк. Може вече да е използван или да е остарял.
          </p>
          <Link href="/" className="mt-5 inline-block text-sm font-semibold text-[#0c0e14] underline">
            Към началото
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Festivo</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight">Управление на имейл</h1>
        <div className="mt-6">
          <UnsubscribeClient token={token} />
        </div>
        <p className="mt-8 text-xs text-black/45">
          Логнат си? Можеш да нагласиш и от{" "}
          <Link href="/profile" className="font-semibold text-[#0c0e14] underline">
            профила
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
