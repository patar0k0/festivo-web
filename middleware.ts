import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserIdReadOnly } from "@/lib/middlewareSession";
import { canBypassJobsRateLimit, checkRateLimit } from "@/lib/rateLimit";
import { verifyApiPostOrigin } from "@/lib/postOriginGuard";
import { getSupabaseEnv } from "@/lib/supabaseServer";

/** For server components (e.g. layout) to choose minimal chrome without client env. */
function withPathnameHeaders(request: NextRequest): Headers {
  const h = new Headers(request.headers);
  h.set("x-festivo-pathname", request.nextUrl.pathname);
  return h;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.method === "POST" && pathname.startsWith("/api/")) {
    if (!canBypassJobsRateLimit(request)) {
      try {
        const userId = await getSessionUserIdReadOnly(request);
        const rate = await checkRateLimit(request, userId);
        if (rate.limited) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
              status: 429,
              headers: {
                "Retry-After": String(rate.resetSeconds),
              },
            }
          );
        }
      } catch {
        // Fail-open: never 500 the site if rate limiting throws unexpectedly.
      }
    }

    const originBlock = verifyApiPostOrigin(request);
    if (originBlock) {
      return originBlock;
    }
  }

  if (pathname.startsWith("/cities/")) {
    const rawSlug = pathname.slice("/cities/".length).replace(/\/+$/, "");
    if (!rawSlug) {
      return NextResponse.next({ request: { headers: withPathnameHeaders(request) } });
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSlug);
    } catch {
      return NextResponse.next({ request: { headers: withPathnameHeaders(request) } });
    }

    const decodedTrim = decoded.trim();
    const looksEncoded = rawSlug.includes("%");
    const hasNonAscii = /[^\x00-\x7F]/.test(decodedTrim);
    const hasUppercase = decodedTrim !== decodedTrim.toLowerCase();
    const differsFromRaw = decodedTrim !== rawSlug;
    const shouldLookup = looksEncoded || hasNonAscii || hasUppercase || differsFromRaw;

    if (shouldLookup) {
      const { url: supabaseUrl, anon: supabaseAnonKey } = getSupabaseEnv();
      if (supabaseUrl && supabaseAnonKey) {
        const query = new URLSearchParams({
          select: "slug",
          limit: "1",
        });

        if (hasNonAscii) {
          const decodedSpaced = decodedTrim.replace(/-/g, " ");
          const orFilters =
            decodedSpaced === decodedTrim
              ? `name_bg.ilike.${decodedTrim}`
              : `name_bg.ilike.${decodedTrim},name_bg.ilike.${decodedSpaced}`;
          query.set("or", `(${orFilters})`);
        } else {
          query.set("slug", `ilike.${decodedTrim}`);
        }

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
            if (matched && matched !== decodedTrim) {
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
    pathname.startsWith("/out") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/logout-preview") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/test";

  const response = NextResponse.next({
    request: {
      headers: withPathnameHeaders(request),
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
