import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/cities/")) {
    const slugPart = pathname.slice("/cities/".length).replace(/\/+$/, "");
    if (slugPart && /[^\x00-\x7F]/.test(slugPart)) {
      try {
        const cityNameBg = decodeURIComponent(slugPart);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const encodedName = encodeURIComponent(cityNameBg);
          const endpoint = `${supabaseUrl}/rest/v1/cities?select=slug&name_bg=eq.${encodedName}&limit=1`;

          const cityResponse = await fetch(endpoint, {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          });

          if (cityResponse.ok) {
            const cityData = (await cityResponse.json()) as Array<{ slug?: string | null }>;
            const matchedSlug = cityData?.[0]?.slug;
            if (matchedSlug) {
              const redirectUrl = request.nextUrl.clone();
              redirectUrl.pathname = `/cities/${matchedSlug}`;
              return NextResponse.redirect(redirectUrl, 308);
            }
          }
        }
      } catch {}
    }
  }

  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const hasPreviewAccess = Boolean(request.cookies.get("festivo_preview")?.value);
  const isAllowlisted =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/logout-preview") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (comingSoonMode && !hasPreviewAccess && pathname !== "/" && !isAllowlisted) {
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
