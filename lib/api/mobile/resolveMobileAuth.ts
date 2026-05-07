import { getUserFromRequest, parseBearerAuthorization } from "@/lib/auth/getUserFromRequest";
import type { GetUserFromRequestResult } from "@/lib/auth/getUserFromRequest";

export type MobileAuthContext = GetUserFromRequestResult & {
  /** True when client sent `Authorization: Bearer <jwt>` (valid or not). */
  hadBearerScheme: boolean;
};

/**
 * Resolves Supabase + user for mobile GET handlers.
 * - Malformed Bearer → caller should respond 401.
 * - Bearer JWT present but `getUser` did not resolve a user → 401 (avoid querying with a broken Authorization header).
 */
export async function resolveMobileRequestAuth(request: Request): Promise<MobileAuthContext> {
  const authHeader = request.headers.get("authorization");
  const bearerProbe = parseBearerAuthorization(authHeader);
  const hadBearerScheme = typeof bearerProbe === "string";

  const ctx = await getUserFromRequest(request);

  return { ...ctx, hadBearerScheme };
}

export function mobileAuthErrorResponse(ctx: MobileAuthContext): Response | null {
  if (ctx.bearerMalformed) {
    return new Response(JSON.stringify({ error: "Invalid Authorization header" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  if (ctx.hadBearerScheme && !ctx.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
