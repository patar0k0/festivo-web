import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
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

let ratelimitSingleton: Ratelimit | null | undefined;

function getRatelimit(): Ratelimit | null {
  if (ratelimitSingleton !== undefined) {
    return ratelimitSingleton;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    ratelimitSingleton = null;
    return ratelimitSingleton;
  }

  ratelimitSingleton = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.multi([
      Ratelimit.fixedWindow(5, "60 s"),
      Ratelimit.fixedWindow(10, "60 s"),
      Ratelimit.fixedWindow(30, "60 s"),
      Ratelimit.fixedWindow(60, "60 s"),
      Ratelimit.fixedWindow(120, "60 s"),
      Ratelimit.fixedWindow(20, "10 s"),
      Ratelimit.fixedWindow(40, "30 s"),
    ]),
    analytics: true,
    prefix: "festivo:rl",
  });

  return ratelimitSingleton;
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

  if (pathname.startsWith("/api/jobs/")) {
    return { id: "jobs", requests: 10, window: "60 s" };
  }

  if (
    pathname.startsWith("/api/plan/") ||
    pathname.startsWith("/api/follow/") ||
    pathname === "/api/device-token" ||
    pathname === "/api/notification-settings"
  ) {
    return { id: "user-actions", requests: 30, window: "60 s" };
  }

  return { id: "api-post", requests: 20, window: "10 s" };
}

function getMatcher(bucket: RateLimitBucket): string {
  return `${bucket.requests};60 s`;
}

export function canBypassJobsRateLimit(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/jobs/")) {
    return false;
  }

  if (request.headers.get("x-vercel-cron")) {
    return true;
  }

  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  return Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
}

export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ratelimit = getRatelimit();
  if (!ratelimit) {
    return { limited: false, resetSeconds: DEFAULT_WINDOW_SECONDS };
  }

  const pathname = request.nextUrl.pathname;
  const bucket = getBucket(pathname);
  const ip = getClientIp(request);
  const key = `${bucket.id}:${ip}`;
  const matcher = getMatcher(bucket);
  const result = await ratelimit.limit(key, { rate: matcher });

  const resetSeconds = result.reset
    ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    : DEFAULT_WINDOW_SECONDS;

  return {
    limited: !result.success,
    resetSeconds,
  };
}
