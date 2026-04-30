import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
import type { NextRequest } from "next/server";

function pathnameFromRequest(request: NextRequest | Request): string {
  if ("nextUrl" in request && request.nextUrl) {
    return request.nextUrl.pathname;
  }
  return new URL(request.url).pathname;
}

type RateLimitBucket = {
  id: string;
  requests: number;
  window: "10 s" | "30 s" | "60 s";
};

type RateLimitResult = {
  limited: boolean;
  resetSeconds: number;
};

const DEFAULT_WINDOW_SECONDS = 60;

let upstashEnv: { url: string; token: string } | null | undefined;
const ratelimitByBucket = new Map<string, Ratelimit>();

function getUpstashEnv(): { url: string; token: string } | null {
  if (upstashEnv !== undefined) return upstashEnv;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashEnv = null;
    return null;
  }

  upstashEnv = { url, token };
  return upstashEnv;
}

function getRatelimit(bucket: RateLimitBucket): Ratelimit | null {
  const env = getUpstashEnv();
  if (!env) return null;

  const key = `${bucket.id}:${bucket.requests}:${bucket.window}`;
  const existing = ratelimitByBucket.get(key);
  if (existing) return existing;

  const instance = new Ratelimit({
    redis: new Redis({ url: env.url, token: env.token }),
    limiter: Ratelimit.fixedWindow(bucket.requests, bucket.window),
    analytics: true,
    prefix: "festivo:rl",
  });

  ratelimitByBucket.set(key, instance);
  return instance;
}

function getClientIp(request: NextRequest | Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

const DESTRUCTIVE_ADMIN_USER_BUCKET: RateLimitBucket = {
  id: "admin-user-destructive-global",
  requests: 20,
  window: "60 s",
};

/** Single-request admin user destructive actions (soft/hard delete, ban, restore, etc.). */
export function isAdminUserDestructiveRequest(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (!pathname.startsWith("/admin/api/users")) return false;

  if (pathname === "/admin/api/users/bulk" && m === "POST") return true;

  const idSeg = "\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (new RegExp(`^/admin/api/users${idSeg}$`, "i").test(pathname) && m === "DELETE") return true;
  if (new RegExp(`^/admin/api/users${idSeg}/hard$`, "i").test(pathname) && m === "DELETE") return true;
  if (new RegExp(`^/admin/api/users${idSeg}/restore$`, "i").test(pathname) && m === "POST") return true;
  if (new RegExp(`^/admin/api/users${idSeg}/ban$`, "i").test(pathname) && m === "POST") return true;
  if (new RegExp(`^/admin/api/users${idSeg}/force-logout$`, "i").test(pathname) && m === "POST") return true;
  if (new RegExp(`^/admin/api/users${idSeg}/reset-password$`, "i").test(pathname) && m === "POST") return true;

  return false;
}

function getBucket(pathname: string, method: string): RateLimitBucket {
  const m = method.toUpperCase();

  if (
    pathname.match(/^\/admin\/api\/users\/[0-9a-f-]{36}\/hard$/i) &&
    m === "DELETE"
  ) {
    return { id: "admin-user-hard-delete", requests: 5, window: "60 s" };
  }
  if (
    pathname.match(/^\/admin\/api\/users\/[0-9a-f-]{36}\/reset-password$/i) &&
    m === "POST"
  ) {
    return { id: "admin-user-reset-password", requests: 10, window: "60 s" };
  }
  if (pathname.match(/^\/admin\/api\/users\/[0-9a-f-]{36}\/force-logout$/i) && m === "POST") {
    return { id: "admin-user-force-logout", requests: 20, window: "60 s" };
  }
  if (pathname.match(/^\/admin\/api\/users\/[0-9a-f-]{36}$/i) && m === "DELETE") {
    return { id: "admin-user-soft-delete", requests: 25, window: "60 s" };
  }
  if (pathname === "/admin/api/users/bulk" && m === "POST") {
    return { id: "admin-users-bulk-request", requests: 15, window: "60 s" };
  }

  if (pathname.startsWith("/api/admin/research-ai")) {
    return { id: "admin-research", requests: 10, window: "60 s" };
  }

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/admin/auth/")) {
    return { id: "auth", requests: 5, window: "60 s" };
  }

  if (
    pathname.startsWith("/api/jobs/") ||
    pathname.startsWith("/api/notifications/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return { id: "jobs", requests: 10, window: "60 s" };
  }

  if (
    pathname.startsWith("/api/plan/") ||
    pathname.startsWith("/api/follow/") ||
    pathname === "/api/device-token" ||
    pathname === "/api/push/register" ||
    pathname === "/api/notification-settings" ||
    pathname === "/api/email/preferences" ||
    pathname === "/api/email/unsubscribe" ||
    pathname === "/api/profile/avatar"
  ) {
    return { id: "user-actions", requests: 30, window: "60 s" };
  }

  return { id: "api-post", requests: 20, window: "10 s" };
}

export function canBypassJobsRateLimit(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (
    !pathname.startsWith("/api/jobs/") &&
    !pathname.startsWith("/api/notifications/") &&
    !pathname.startsWith("/api/cron/")
  ) {
    return false;
  }

  if (request.headers.get("x-vercel-cron")) {
    return true;
  }

  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  return Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
}

function rateLimitIdentityKey(request: NextRequest | Request, userId: string | null): string {
  if (userId) {
    return `u:${userId}`;
  }
  return `ip:${getClientIp(request)}`;
}

function resetSecondsFromResult(result: { reset?: number }): number {
  return result.reset
    ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    : DEFAULT_WINDOW_SECONDS;
}

/**
 * Bulk user actions: consume one token per target user (cap 50) against an operation budget.
 */
export async function consumeAdminBulkUserOperationTokens(
  request: NextRequest | Request,
  adminUserId: string,
  operationCount: number,
): Promise<RateLimitResult> {
  const bucket: RateLimitBucket = {
    id: "admin-users-bulk-operations",
    requests: 60,
    window: "60 s",
  };
  const ratelimit = getRatelimit(bucket);
  if (!ratelimit) {
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }

  const identity = rateLimitIdentityKey(request, adminUserId);
  const key = `${bucket.id}:${identity}`;
  const n = Math.max(0, Math.min(operationCount, 55));

  try {
    let worstReset = DEFAULT_WINDOW_SECONDS;
    for (let i = 0; i < n; i++) {
      const result = await ratelimit.limit(key);
      worstReset = resetSecondsFromResult(result);
      if (!result.success) {
        return { limited: true, resetSeconds: worstReset };
      }
    }
    return { limited: false, resetSeconds: worstReset };
  } catch {
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }
}

export async function checkRateLimit(
  request: NextRequest,
  userId: string | null = null,
): Promise<RateLimitResult> {
  const pathname = pathnameFromRequest(request);
  const bucket = getBucket(pathname, request.method);
  const ratelimit = getRatelimit(bucket);
  if (!ratelimit) {
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }

  const identity = rateLimitIdentityKey(request, userId);
  const key = `${bucket.id}:${identity}`;

  try {
    const result = await ratelimit.limit(key);
    const resetSeconds = resetSecondsFromResult(result);

    if (!result.success) {
      return {
        limited: true,
        resetSeconds,
      };
    }

    if (userId && isAdminUserDestructiveRequest(pathname, request.method)) {
      const d = getRatelimit(DESTRUCTIVE_ADMIN_USER_BUCKET);
      if (d) {
        const dKey = `${DESTRUCTIVE_ADMIN_USER_BUCKET.id}:${identity}`;
        const dResult = await d.limit(dKey);
        const dReset = resetSecondsFromResult(dResult);
        if (!dResult.success) {
          return { limited: true, resetSeconds: dReset };
        }
      }
    }

    return {
      limited: false,
      resetSeconds,
    };
  } catch {
    // Fail-open: Upstash/network/auth errors must not take down the site.
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }
}
