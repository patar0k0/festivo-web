import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/cities/")) {
    const rawSlug = pathname.slice("/cities/".length).replace(/\/+$/, "");
    if (rawSlug) {
      const decoded = decodeURIComponent(rawSlug);
      const looksEncoded = rawSlug.includes("%");
      const hasNonAscii = /[^\x00-\x7F]/.test(decoded);
      if (!(looksEncoded || hasNonAscii)) return NextResponse.next();
      const { url: supabaseUrl, anon: supabaseAnonKey } = getSupabaseEnv();
      if (supabaseUrl && supabaseAnonKey) {
        const decodedSpaced = decoded.replace(/-/g, " ");
        const orFilters =
          decodedSpaced === decoded
            ? `name_bg.ilike.${decoded}`
            : `name_bg.ilike.${decoded},name_bg.ilike.${decodedSpaced}`;
        const query = new URLSearchParams({
          select: "slug",
          or: `(${orFilters})`,
          limit: "1",
        });
        const endpoint = `${supabaseUrl}/rest/v1/cities?${query.toString()}`;
        try {
          const r = await fetch(endpoint, {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            cache: "no-store",
          });
          if (r.ok) {
            const rows = (await r.json()) as Array<{ slug?: string | null }>;
            const matched = rows?.[0]?.slug;
            if (matched) {
              return NextResponse.redirect(new URL(`/cities/${matched}`, request.url), 308);
            }
          }
        } catch {
          // ignore
        }
      }
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
