import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import SiteNavClient from "@/components/SiteNavClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  let isAuthenticated = false;
  let userEmail: string | null = null;
  let isAdmin = false;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user?.id);
    userEmail = user?.email ?? null;
    const jwtRole = user?.app_metadata?.role;
    isAdmin = jwtRole === "admin" || jwtRole === "super_admin";
  } catch {
    // Graceful fallback when Supabase env vars are missing (e.g. local dev)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#f5f4f0]/85 backdrop-blur-md">
      <Container className="flex items-center justify-between py-2.5">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 no-underline" aria-label="Festivo.bg">
          <Image
            src="/brand/festivo-logo-badge.jpg"
            alt="Festivo"
            width={44}
            height={44}
            className="h-9 w-9 rounded-full object-cover md:h-10 md:w-10"
            priority
          />
          <span className="text-[17px] font-bold tracking-tight text-[#7c2d12] md:text-[19px]">
            Festivo
            <span className="text-[10px] font-semibold text-[#7c2d12]/55 md:text-[11px]">.bg</span>
          </span>
        </Link>
        <SiteNavClient isAuthenticated={isAuthenticated} isAdmin={isAdmin} userEmail={userEmail} />
      </Container>
    </header>
  );
}
