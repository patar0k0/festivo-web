import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const isAllowlisted =
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (comingSoonMode && !isAllowlisted) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico$|robots.txt$|sitemap.xml$|.*\\..*).*)"],
};
