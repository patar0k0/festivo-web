import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import OutreachTemplatesClient from "./OutreachTemplatesClient";

export const dynamic = "force-dynamic";

export default async function OutreachTemplatesPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) redirect("/login?next=/admin/outreach-templates");

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("outreach_email_templates")
    .select("id,name,subject,body,sort_order,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0c0e14]">Шаблони за outreach имейли</h1>
          <p className="mt-1 text-sm text-black/50">Шаблоните се зареждат в модала „✉ Покани" при изпращане към организатори.</p>
        </div>
      </div>
      <OutreachTemplatesClient initialTemplates={data ?? []} />
    </div>
  );
}
