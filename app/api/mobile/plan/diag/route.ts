import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Temporary diagnostic endpoint — REMOVE after root cause identified
export async function GET(request: Request) {
  const steps: Record<string, unknown> = {};

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    steps.userId = auth.user.id;

    // Step 1: can user-scoped client SELECT from user_plan_festivals?
    const { data: selectData, error: selectError } = await auth.supabase
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", auth.user.id)
      .limit(5);
    steps.select = selectError
      ? { ok: false, code: selectError.code, message: selectError.message }
      : { ok: true, count: (selectData ?? []).length };

    // Step 2: can adminDb SELECT from user_plan_festivals?
    const adminDb = createSupabaseAdmin();
    const { data: adminSelectData, error: adminSelectError } = await adminDb
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", auth.user.id)
      .limit(5);
    steps.adminSelect = adminSelectError
      ? { ok: false, code: adminSelectError.code, message: adminSelectError.message }
      : { ok: true, count: (adminSelectData ?? []).length };

    // Step 3: find a festival to test with
    const { data: festivals, error: festivalsError } = await adminDb
      .from("festivals")
      .select("id")
      .limit(1);
    steps.festivalsLookup = festivalsError
      ? { ok: false, message: festivalsError.message }
      : { ok: true, id: festivals?.[0]?.id ?? null };

    const testFestivalId = (festivals?.[0] as { id?: string } | null)?.id ?? null;

    if (testFestivalId) {
      // Step 4: try adminDb INSERT (will likely fail with 23505 if already saved)
      const { error: insertError } = await adminDb
        .from("user_plan_festivals")
        .insert({ user_id: auth.user.id, festival_id: testFestivalId });
      steps.adminInsert = insertError
        ? { ok: false, code: insertError.code, message: insertError.message, hint: insertError.hint }
        : { ok: true };

      // Step 5: try adminDb DELETE (safe - only deletes what was just inserted or nothing)
      const { error: deleteError } = await adminDb
        .from("user_plan_festivals")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("festival_id", testFestivalId);
      steps.adminDelete = deleteError
        ? { ok: false, code: deleteError.code, message: deleteError.message }
        : { ok: true };
    }

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, caught: e instanceof Error ? e.message : String(e), steps }, { status: 500 });
  }
}
