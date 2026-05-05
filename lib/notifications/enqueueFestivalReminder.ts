import { supabaseServer } from "@/lib/supabaseServer";

export async function enqueueFestivalReminder({
  userId,
  festivalId,
}: {
  userId: string;
  festivalId: string;
}) {
  try {
    console.log("[REMINDER] enqueue start", { userId, festivalId });
    const supabase = supabaseServer();
    if (!supabase) {
      console.error("[REMINDER] missing Supabase env");
      return;
    }

    const { data: festival } = await supabase
      .from("festivals")
      .select("id, slug, title, start_date")
      .eq("id", festivalId)
      .single();

    if (!festival?.start_date) return;

    const start = new Date(festival.start_date);
    const scheduledAt = new Date(start.getTime() - 24 * 60 * 60 * 1000);

    if (scheduledAt < new Date()) return;

    // prevent duplicates
    const { data: existing } = await supabase
      .from("notification_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "festival_reminder")
      .contains("payload", { festivalId })
      .limit(1);

    if (existing?.length) return;

    console.log("[REMINDER] inserting job");
    await supabase.from("notification_jobs").insert({
      user_id: userId,
      type: "festival_reminder",
      status: "pending",
      scheduled_at: scheduledAt.toISOString(),
      payload: {
        festivalId,
        slug: festival.slug,
        title: festival.title,
      },
    });
    console.log("[REMINDER] insert success");
  } catch (e) {
    console.error("[REMINDER ERROR]", e);
  }
}
