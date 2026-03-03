import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  festivalId?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Payload;
  const festivalId = body.festivalId;

  if (!festivalId) {
    return NextResponse.json({ error: "Missing festivalId" }, { status: 400 });
  }

  const getExistingRow = async () =>
    supabase
      .from("user_plan_festivals")
      .select("festival_id")
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .maybeSingle();

  const { data: existing, error: existingError } = await getExistingRow();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("user_plan_festivals")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { data: verifyRow, error: verifyError } = await getExistingRow();
    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inPlan: Boolean(verifyRow) });
  }

  const { error: insertError } = await supabase.from("user_plan_festivals").insert({
    user_id: user.id,
    festival_id: festivalId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: verifyRow, error: verifyError } = await getExistingRow();
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inPlan: Boolean(verifyRow) });
}
