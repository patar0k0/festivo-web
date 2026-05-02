import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserIdReadOnly } from "@/lib/middlewareSession";
import { canBypassJobsRateLimit, checkRateLimit } from "@/lib/rateLimit";
import { verifyApiPostOrigin } from "@/lib/postOriginGuard";
import { getSupabaseEnv } from "@/lib/supabaseServer";
import { getCachedUserGate, setCachedUserGate } from "@/lib/middlewareUserGateCache";

/**
 * Routes where we do not force-clear auth for missing `public.users` row.
 * `/login` and `/signup` are not exempt: a broken session is cleared there before
 * `login` can redirect `next=/admin` (avoids admin ↔ login loops).
 */
function isInvalidSessionPurgeExempt(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    (pathname.startsWith("/api/") && !pathname.startsWith("/admin/api/")) ||
    pathname.startsWith("/account-deleted") ||
    pathname.startsWith("/banned") ||
    pathname.startsWith("/out") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/logout-preview") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/unsubscribe")
  );
}

async function signOutAndRedirectHome(
  request: NextRequest,
  url: string,
  anon: string,
): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.delete("sb-access-token");
  res.cookies.delete("sb-refresh-token");
  const supabaseSignOut = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });
  await supabaseSignOut.auth.signOut();
  return res;
}

/** For server components (e.g. layout) to choose minimal chrome without client env. */
function withPathnameHeaders(request: NextRequest): Headers {
  const h = new Headers(request.headers);
  h.set("x-festivo-pathname", request.nextUrl.pathname);
  return h;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to all write operations on /api/* and /admin/api/*
  // (POST, PATCH, PUT, DELETE). GET requests are intentionally excluded.
  const isApiWriteMethod = ["POST", "PATCH", "PUT", "DELETE"].includes(
    request.method,
  );

  const isApiPath =
    pathname.startsWith("/api/") || pathname.startsWith("/admin/api/");

  if (isApiWriteMethod && isApiPath) {
    const skipRateLimitForPath =
      pathname.startsWith("/admin/api/discovery") || pathname === "/api/email/webhook";
    const shouldApplyRateLimit = !skipRateLimitForPath && !canBypassJobsRateLimit(request);
    if (shouldApplyRateLimit) {
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
            },
          );
        }
      } catch {
        // fail-open: do not block request if limiter fails
      }
    }
  }

  if (request.method === "POST" && pathname.startsWith("/api/")) {
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
    pathname.startsWith("/account-deleted") ||
    pathname.startsWith("/banned") ||
    pathname.startsWith("/out") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/unsubscribe") ||
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const bannedUntil = user.banned_until;
    const isBanned = bannedUntil != null && bannedUntil !== "" && new Date(bannedUntil) > new Date();

    const cachedGate = getCachedUserGate(user.id);
    let gateReady = cachedGate != null;
    let userRowExists = cachedGate != null;
    let deletedAt: string | null | undefined = cachedGate?.deleted_at ?? undefined;
    let dbBannedUntil: string | null | undefined = cachedGate?.banned_until ?? undefined;

    if (cachedGate == null) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 40 * attempt));
        }
        const res = await supabase.from("users").select("deleted_at, banned_until").eq("id", user.id).maybeSingle();
        if (!res.error) {
          gateReady = true;
          userRowExists = res.data != null;
          if (res.data) {
            deletedAt = res.data.deleted_at ?? null;
            dbBannedUntil = (res.data as { banned_until?: string | null }).banned_until ?? null;
            setCachedUserGate(user.id, {
              deleted_at: deletedAt ?? null,
              banned_until: dbBannedUntil ?? null,
            });
          }
          break;
        }
        if (attempt === 2) {
          console.error("[middleware] users gate lookup failed after retries", res.error);
        }
      }
    }

    const isDeletedAccount = userRowExists && Boolean(deletedAt);
    const dbBanActive =
      dbBannedUntil != null &&
      dbBannedUntil !== "" &&
      new Date(dbBannedUntil) > new Date();
    const isBannedEffective = isBanned || dbBanActive;

    if (isDeletedAccount || isBannedEffective) {
      const targetPath = isDeletedAccount ? "/account-deleted" : "/banned";
      // Deleted users must remain signed in on `/account-deleted` so the page can verify `users.deleted_at`.
      if (isDeletedAccount && pathname.startsWith("/account-deleted")) {
        return response;
      }
      const redirectResponse = NextResponse.redirect(new URL(targetPath, request.url));
      if (isDeletedAccount) {
        return redirectResponse;
      }
      const supabaseSignOut = createServerClient(url, anon, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      });
      await supabaseSignOut.auth.signOut();
      return redirectResponse;
    }

    if (gateReady && !isInvalidSessionPurgeExempt(pathname) && !userRowExists) {
      return signOutAndRedirectHome(request, url, anon);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico$|robots.txt$|sitemap.xml$|.*\\..*).*)"],
};
