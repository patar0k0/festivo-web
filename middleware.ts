import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserIdReadOnly } from "@/lib/middlewareSession";
import { canBypassJobsRateLimit, checkPublicPageRateLimit, checkRateLimit } from "@/lib/rateLimit";
import { guardMobileApiRequest } from "@/lib/mobileApiGuard";
import { verifyApiPostOrigin } from "@/lib/postOriginGuard";
import { getSupabaseEnv } from "@/lib/supabaseServer";
import { getCachedUserGate, setCachedUserGate } from "@/lib/middlewareUserGateCache";
import { ensurePublicUserRowForSession } from "@/lib/ensurePublicUserRowForSession";

// ---------------------------------------------------------------------------
// Bot / scraper detection
// ---------------------------------------------------------------------------

/**
 * Known legitimate crawlers — never block these regardless of other signals.
 * They respect robots.txt and are needed for SEO / social previews.
 */
const LEGITIMATE_BOT_RE =
  /googlebot|bingbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|applebot|yandexbot|ahrefsbot|semrushbot|mj12bot/i;

/**
 * Headless / script UA patterns that have no place on a public festival catalog.
 * Only checked when the UA does NOT contain "Mozilla/5.0" (real browsers always do).
 */
const SCRAPER_UA_RE =
  /python[-_]?(?:requests|urllib)|python\/\d|\bscrapy\b|\bcurl\/|\bwget\/|go-http-client|okhttp\/|aiohttp\/|httpx\/|node-fetch|undici|\baxios\/|libwww-perl|java\/\d|ruby\/\d|php\/\d/i;

function isBotRequest(ua: string): boolean {
  if (!ua || ua.length < 8) return true; // empty / suspiciously short UA
  if (LEGITIMATE_BOT_RE.test(ua)) return false; // always allow known good bots
  if (ua.includes("Mozilla/5.0")) return false; // real browser
  return SCRAPER_UA_RE.test(ua);
}

/** Public content pages that scrapers target. */
function isPublicContentPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/festivals") ||
    pathname === "/map" ||
    pathname === "/calendar" ||
    pathname.startsWith("/cities/") ||
    pathname.startsWith("/organizers/")
  );
}

/**
 * Routes where we do not force-clear auth for missing `public.users` row (fallback).
 * Sessions normally get a shadow row via `ensurePublicUserRowForSession` after `getUser()`.
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

  // ---------------------------------------------------------------------------
  // 1. Bot / scraper UA block — runs before everything else, zero latency.
  //    Legitimate crawlers (Googlebot etc.) are explicitly allowed.
  //    Admin, API and auth paths are exempt so automated tools still work there.
  // ---------------------------------------------------------------------------
  const isAdminOrApiPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  if (!isAdminOrApiPath && request.method === "GET") {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBotRequest(ua)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Public content page rate limiting (unauthenticated IPs only).
  //    100 page requests / minute per IP. Real users never reach this;
  //    scrapers cycling through /festivals/* do.
  // ---------------------------------------------------------------------------
  if (request.method === "GET" && isPublicContentPage(pathname)) {
    // Check for session cookie cheaply — skip rate limit for logged-in users.
    const hasSbCookie =
      request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.value);
    if (!hasSbCookie) {
      try {
        const pageRate = await checkPublicPageRateLimit(request);
        if (pageRate.limited) {
          return new NextResponse("Too many requests", {
            status: 429,
            headers: { "Retry-After": String(pageRate.resetSeconds) },
          });
        }
      } catch {
        // fail-open
      }
    }
  }

  // Mobile API: handle OPTIONS preflight and reject browser cross-origin
  // requests before any other work. Native (Origin-less) requests fall through.
  const mobileGuardResponse = guardMobileApiRequest(request);
  if (mobileGuardResponse) {
    return mobileGuardResponse;
  }

  // Apply rate limiting to all write operations on /api/* and /admin/api/*
  // (POST, PATCH, PUT, DELETE). GET requests are intentionally excluded —
  // EXCEPT for /api/mobile/* where reads are also limited (anti-scraping).
  const isApiWriteMethod = ["POST", "PATCH", "PUT", "DELETE"].includes(
    request.method,
  );
  const isMobileApiPath = pathname.startsWith("/api/mobile/");

  const isApiPath =
    pathname.startsWith("/api/") || pathname.startsWith("/admin/api/");

  if ((isApiWriteMethod || isMobileApiPath) && isApiPath) {
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
    const usersShadowUpsertOk = await ensurePublicUserRowForSession(supabase, user);

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

    if (
      usersShadowUpsertOk &&
      gateReady &&
      !isInvalidSessionPurgeExempt(pathname) &&
      !userRowExists
    ) {
      return signOutAndRedirectHome(request, url, anon);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico$|robots.txt$|sitemap.xml$|.*\\..*).*)"],
};
