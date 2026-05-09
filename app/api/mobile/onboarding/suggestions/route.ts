import { NextResponse } from "next/server";

import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { buildOnboardingSuggestions, parseOnboardingPreferenceSlugs } from "@/lib/recommendations/onboardingSuggestions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY_PAYLOAD = {
  categories: [],
  cities: [],
  organizers: [],
} as const;

function logOnboardingSuggestionsDev(event: string, details: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error("[api/mobile/onboarding/suggestions][dev]", { event, ...details });
}

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authError = mobileAuthErrorResponse(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const { categorySlugs, citySlugs } = parseOnboardingPreferenceSlugs(url);
    const admin = supabaseAdmin();
    const supabase = admin ?? auth.supabase;

    if (!admin) {
      logOnboardingSuggestionsDev("service_role_missing_fallback_client", {
        hadUser: Boolean(auth.user?.id),
      });
    }

    const payload = await buildOnboardingSuggestions({
      supabase,
      user: auth.user,
      selectedCategorySlugs: categorySlugs,
      selectedCitySlugs: citySlugs,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    logOnboardingSuggestionsDev("handler_failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(EMPTY_PAYLOAD, { status: 200 });
  }
}
