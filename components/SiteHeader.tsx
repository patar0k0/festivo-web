import Link from "next/link";
import Container from "@/components/ui/Container";
import SiteNavClient from "@/components/SiteNavClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user?.id);
  const userEmail = user?.email ?? null;
  let isAdmin = false;

  if (user?.id) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    isAdmin = Boolean(roleRow);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-[#f5f4f0]/90 backdrop-blur-xl">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#0c0e14]">
          <span className="font-[var(--font-display)] text-2xl">Festivo</span>
        </Link>
        <SiteNavClient isAuthenticated={isAuthenticated} isAdmin={isAdmin} userEmail={userEmail} />
      </Container>
    </header>
  );
}
