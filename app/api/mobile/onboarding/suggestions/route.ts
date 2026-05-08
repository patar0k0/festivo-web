import { NextResponse } from "next/server";

import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { buildOnboardingSuggestions, parseOnboardingPreferenceSlugs } from "@/lib/recommendations/onboardingSuggestions";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authError = mobileAuthErrorResponse(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const { categorySlugs, citySlugs } = parseOnboardingPreferenceSlugs(url);
    const supabase = createSupabaseAdmin();

    const payload = await buildOnboardingSuggestions({
      supabase,
      user: auth.user,
      selectedCategorySlugs: categorySlugs,
      selectedCitySlugs: citySlugs,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[api/mobile/onboarding/suggestions]", error);
    return NextResponse.json(
      {
        categories: [],
        cities: [],
        organizers: [],
      },
      { status: 500 },
    );
  }
}
