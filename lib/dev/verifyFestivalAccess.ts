import { getAdminSession } from "@/lib/admin/isAdmin";
import { getPortalSessionUser } from "@/lib/organizer/portal";
import { getFestivalBySlug, normalizePublicFestivalSlugParam } from "@/lib/queries";
import { debugLog } from "@/lib/utils/debugLog";

type DevAccessRole = "admin" | "organizer" | "anon";

/**
 * Development-only: logs whether the current session can see a festival row via RLS (`getFestivalBySlug`).
 * Import and call from a server route or page while debugging access issues; no-ops in production.
 */
export async function verifyFestivalAccessDev(rawSlug: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const [adminSession, portal, festival] = await Promise.all([
    getAdminSession(),
    getPortalSessionUser(),
    getFestivalBySlug(slug),
  ]);

  let role: DevAccessRole = "anon";
  if (adminSession?.isAdmin) {
    role = "admin";
  } else if (portal?.user?.id) {
    role = "organizer";
  }

  debugLog({
    slug,
    found: festival != null,
    role,
    status: festival?.status,
    is_verified: festival?.is_verified,
  });
}
