const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

let missingTurnstileConfigLogged = false;

function logMissingTurnstileConfigOnce() {
  if (missingTurnstileConfigLogged || turnstileConfigured()) {
    return;
  }
  missingTurnstileConfigLogged = true;
  console.warn(
    "[turnstile] Bot checks disabled: set TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY to enforce Turnstile on signup and organizer forms.",
  );
}

/** When false, callers should skip enforcement (fail-open for local dev). */
export function shouldEnforceTurnstile(): boolean {
  if (!turnstileConfigured()) {
    logMissingTurnstileConfigOnce();
    return false;
  }
  return true;
}

/**
 * Verifies a Turnstile token with Cloudflare siteverify.
 * Call only when `shouldEnforceTurnstile()` is true (both env vars set).
 */
export async function verifyTurnstileToken(token: string | undefined, ip?: string | null): Promise<boolean> {
  if (!turnstileConfigured()) {
    return true;
  }

  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    return false;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY!.trim();

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", trimmed);
  if (ip) {
    body.set("remoteip", ip);
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (e) {
    console.error("[turnstile] siteverify request failed", e);
    return false;
  }
}

export function getRequestClientIp(request: Request): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || undefined;
}
