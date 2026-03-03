import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DebugAuthPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const sbCookieNames = cookieNames.filter((name) => name.startsWith("sb-"));
  const hasSbCookie = sbCookieNames.length > 0;
  const hasAuthTokenCookie = cookieNames.some((name) => name.includes("-auth-token"));
  const hasCodeVerifierCookie = cookieNames.some((name) => name.includes("code-verifier"));

  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  return (
    <main>
      <h1>Debug Auth</h1>
      <p>userId: {userId ?? "null"}</p>
      <p>hasSbCookie: {hasSbCookie ? "true" : "false"}</p>
      <p>hasAuthTokenCookie: {hasAuthTokenCookie ? "true" : "false"}</p>
      <p>hasCodeVerifierCookie: {hasCodeVerifierCookie ? "true" : "false"}</p>
      <pre>sbCookieNames: {JSON.stringify(sbCookieNames, null, 2)}</pre>
    </main>
  );
}
