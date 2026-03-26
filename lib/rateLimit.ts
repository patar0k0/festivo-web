import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
import type { NextRequest } from "next/server";

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

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function getBucket(pathname: string): RateLimitBucket {
  if (pathname.startsWith("/api/admin/research-ai")) {
    return { id: "admin-research", requests: 10, window: "60 s" };
  }

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/admin/auth/")) {
    return { id: "auth", requests: 5, window: "60 s" };
  }

  if (pathname.startsWith("/api/jobs/") || pathname.startsWith("/api/notifications/")) {
    return { id: "jobs", requests: 10, window: "60 s" };
  }

  if (
    pathname.startsWith("/api/plan/") ||
    pathname.startsWith("/api/follow/") ||
    pathname === "/api/device-token" ||
    pathname === "/api/push/register" ||
    pathname === "/api/notification-settings"
  ) {
    return { id: "user-actions", requests: 30, window: "60 s" };
  }

  return { id: "api-post", requests: 20, window: "10 s" };
}

export function canBypassJobsRateLimit(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/jobs/") && !pathname.startsWith("/api/notifications/")) {
    return false;
  }

  if (request.headers.get("x-vercel-cron")) {
    return true;
  }

  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  return Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
}

function rateLimitIdentityKey(request: NextRequest, userId: string | null): string {
  if (userId) {
    return `u:${userId}`;
  }
  return `ip:${getClientIp(request)}`;
}

export async function checkRateLimit(
  request: NextRequest,
  userId: string | null = null,
): Promise<RateLimitResult> {
  const pathname = request.nextUrl.pathname;
  const bucket = getBucket(pathname);
  const ratelimit = getRatelimit(bucket);
  if (!ratelimit) {
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }

  const identity = rateLimitIdentityKey(request, userId);
  const key = `${bucket.id}:${identity}`;

  try {
    const result = await ratelimit.limit(key);

    const resetSeconds = result.reset
      ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      : DEFAULT_WINDOW_SECONDS;

    return {
      limited: !result.success,
      resetSeconds,
    };
  } catch {
    // Fail-open: Upstash/network/auth errors must not take down the site.
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }
}
