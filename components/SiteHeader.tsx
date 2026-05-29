import Image from "next/image";
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
  const jwtRole = user?.app_metadata?.role;
  const isAdmin = jwtRole === "admin" || jwtRole === "super_admin";

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-[#f5f4f0]/95">
      <Container className="flex items-center justify-between py-3">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 text-[#0c0e14] no-underline">
          <Image
            src="/brand/festivo-logo-badge.jpg"
            alt="Festivo"
            width={48}
            height={48}
            className="h-10 w-10 rounded-full object-cover md:h-11 md:w-11"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-[#7c2d12] md:text-2xl">
            Festivo
          </span>
        </Link>
        <SiteNavClient isAuthenticated={isAuthenticated} isAdmin={isAdmin} userEmail={userEmail} />
      </Container>
    </header>
  );
}
