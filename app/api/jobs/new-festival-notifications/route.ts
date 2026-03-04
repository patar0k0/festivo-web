import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = {
  festival_id?: string;
};

type FestivalRow = {
  id: string;
  title: string | null;
  city: string | null;
  city_slug: string | null;
  category_slug: string | null;
  organizer_id: string | null;
};

type UserRow = {
  user_id: string;
};

type SettingsRow = {
  user_id: string;
  notify_new_festivals_city: boolean;
  notify_new_festivals_category: boolean;
  notify_followed_organizers: boolean;
};

const BATCH_SIZE = 500;

function chunk<T>(input: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    batches.push(input.slice(i, i + size));
  }
  return batches;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  const isCron = request.headers.get("x-vercel-cron");

  if (!isCron && (!expectedSecret || providedSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const body = (await request.json()) as Payload;
  const festivalId = body.festival_id?.trim();

  if (!festivalId) {
    return NextResponse.json({ error: "Missing festival_id" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("id,title,city,city_slug,category_slug,organizer_id")
    .eq("id", festivalId)
    .single();

  if (festivalError) {
    return NextResponse.json({ error: festivalError.message }, { status: 500 });
  }

  const festivalRow = festival as FestivalRow;

  if (!festivalRow.city_slug && !festivalRow.category_slug && !festivalRow.organizer_id) {
    return NextResponse.json({ created: 0, skipped: 0, recipients: 0 });
  }

  const cityFollowerIds = new Set<string>();
  const categoryFollowerIds = new Set<string>();
  const organizerFollowerIds = new Set<string>();

  if (festivalRow.city_slug) {
    const { data, error } = await supabase
      .from("user_followed_cities")
      .select("user_id")
      .eq("city_slug", festivalRow.city_slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const row of (data ?? []) as UserRow[]) {
      cityFollowerIds.add(row.user_id);
    }
  }

  if (festivalRow.category_slug) {
    const { data, error } = await supabase
      .from("user_followed_categories")
      .select("user_id")
      .eq("category_slug", festivalRow.category_slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const row of (data ?? []) as UserRow[]) {
      categoryFollowerIds.add(row.user_id);
    }
  }

  if (festivalRow.organizer_id) {
    const { data, error } = await supabase
      .from("user_followed_organizers")
      .select("user_id")
      .eq("organizer_id", festivalRow.organizer_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const row of (data ?? []) as UserRow[]) {
      organizerFollowerIds.add(row.user_id);
    }
  }

  const candidateIds = Array.from(new Set([...cityFollowerIds, ...categoryFollowerIds, ...organizerFollowerIds]));

  if (!candidateIds.length) {
    return NextResponse.json({ created: 0, skipped: 0, recipients: 0 });
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from("user_notification_settings")
    .select("user_id,notify_new_festivals_city,notify_new_festivals_category,notify_followed_organizers")
    .in("user_id", candidateIds);

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  const settingsMap = new Map<string, SettingsRow>();
  for (const row of (settingsRows ?? []) as SettingsRow[]) {
    settingsMap.set(row.user_id, row);
  }

  const defaultSettings: Omit<SettingsRow, "user_id"> = {
    notify_new_festivals_city: true,
    notify_new_festivals_category: false,
    notify_followed_organizers: true,
  };

  const recipients = candidateIds.filter((userId) => {
    const userSettings = settingsMap.get(userId) ?? { user_id: userId, ...defaultSettings };

    const matchedCity = cityFollowerIds.has(userId) && userSettings.notify_new_festivals_city;
    const matchedCategory = categoryFollowerIds.has(userId) && userSettings.notify_new_festivals_category;
    const matchedOrganizer = organizerFollowerIds.has(userId) && userSettings.notify_followed_organizers;

    return matchedCity || matchedCategory || matchedOrganizer;
  });

  if (!recipients.length) {
    return NextResponse.json({ created: 0, skipped: 0, recipients: 0 });
  }

  const nowIso = new Date().toISOString();
  const cityLabel = festivalRow.city ?? festivalRow.city_slug ?? "your city";
  const notifications = recipients.map((userId) => ({
    user_id: userId,
    festival_id: festivalRow.id,
    type: "new_festival",
    title: "New festival announced",
    body: `${festivalRow.title ?? "A new festival"} in ${cityLabel}`,
    scheduled_for: nowIso,
    sent_at: nowIso,
  }));

  let created = 0;

  for (const batch of chunk(notifications, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("user_notifications")
      .upsert(batch, { onConflict: "user_id,festival_id,type", ignoreDuplicates: true })
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    created += data?.length ?? 0;
  }

  return NextResponse.json({ created, skipped: notifications.length - created, recipients: recipients.length });
}
