import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { STORAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage/cacheControl";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";
import { logAdminAction } from "@/lib/admin/audit-log";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  return null;
}

function extensionFromFileName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

type PortalAdminClient = ReturnType<typeof getPortalAdminClient>;

async function assertGalleryInsertAllowed(
  admin: PortalAdminClient,
  organizerId: string,
  festivalId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(admin, organizerId);
  if (orgFetchError) {
    return { ok: false, response: NextResponse.json({ error: orgFetchError.message }, { status: 500 }) };
  }

  const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
  const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

  const { count: nonHeroCount, error: nonHeroCountError } = await admin
    .from("festival_media")
    .select("id", { count: "exact", head: true })
    .eq("festival_id", festivalId)
    .eq("is_hero", false);

  if (nonHeroCountError) {
    return { ok: false, response: NextResponse.json({ error: nonHeroCountError.message }, { status: 500 }) };
  }

  const currentImages = typeof nonHeroCount === "number" ? nonHeroCount : 0;
  if (currentImages >= limits.gallery) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "gallery", current: currentImages, limit: limits.gallery, plan }) },
        { status: 409 },
      ),
    };
  }

  return { ok: true };
}

async function insertGalleryRowAndMarkEdited(
  admin: PortalAdminClient,
  festivalId: string,
  publicUrl: string,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const { data: maxRow } = await admin
    .from("festival_media")
    .select("sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

  const { data: inserted, error: insertError } = await admin
    .from("festival_media")
    .insert({ festival_id: festivalId, url: publicUrl, type: "image", sort_order: nextOrder, is_hero: false })
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .maybeSingle();

  if (insertError) {
    return { ok: false, response: NextResponse.json({ error: insertError.message }, { status: 500 }) };
  }
  if (!inserted) {
    return { ok: false, response: NextResponse.json({ error: "Добавянето не бе успешно." }, { status: 500 }) };
  }

  await admin.from("festivals").update({ last_edited_by_organizer_at: new Date().toISOString() }).eq("id", festivalId);

  return { ok: true, row: inserted as Record<string, unknown> };
}

async function logOrganizerMediaAction(
  actorUserId: string,
  festivalId: string,
  organizerId: string,
  action: "added" | "removed",
  url: string,
) {
  try {
    await logAdminAction({
      actor_user_id: actorUserId,
      action: action === "added" ? "festival.organizer_media_added" : "festival.organizer_media_removed",
      entity_type: "festival",
      entity_id: festivalId,
      route: "/api/organizer/festivals/[id]/media",
      method: action === "added" ? "POST" : "DELETE",
      details: { organizer_id: organizerId, url },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_media failed", { message });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin: PortalAdminClient;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { data, error } = await admin
    .from("festival_media")
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .eq("festival_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin: PortalAdminClient;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id: festivalId } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, festivalId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
      const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
      if (!sourceUrl.trim()) {
        return NextResponse.json({ error: "Изисква се връзка към снимка." }, { status: 400 });
      }
      if (!/^https?:\/\//i.test(sourceUrl.trim())) {
        return NextResponse.json({ error: "Връзката трябва да започва с http:// или https://." }, { status: 400 });
      }

      const eligibility = await assertGalleryInsertAllowed(admin, gate.organizerId, festivalId);
      if (!eligibility.ok) return eligibility.response;

      const timestamp = Date.now();
      const outcome = await rehostHeroImageIfRemote(
        admin,
        sourceUrl,
        (ext) => `festival-hero/gallery/festival-${festivalId}-${timestamp}.${ext}`,
      );
      if (!outcome.ok) {
        return NextResponse.json({ error: outcome.error }, { status: 422 });
      }

      const inserted = await insertGalleryRowAndMarkEdited(admin, festivalId, outcome.publicUrl);
      if (!inserted.ok) return inserted.response;

      await logOrganizerMediaAction(session.user.id, festivalId, gate.organizerId, "added", outcome.publicUrl);
      return NextResponse.json({ ok: true, row: inserted.row });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Не е предоставен файл." }, { status: 400 });
    }
    if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Позволени са само изображения." }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Файлът е празен." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Файлът е твърде голям. Максимум ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    const extension = extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "bin";
    const timestamp = Date.now();
    const objectPath = `festival-hero/gallery/festival-${festivalId}-${timestamp}.${extension}`;

    const eligibility = await assertGalleryInsertAllowed(admin, gate.organizerId, festivalId);
    if (!eligibility.ok) return eligibility.response;

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(HERO_IMAGES_BUCKET).upload(objectPath, imageBuffer, {
      upsert: false,
      contentType: file.type,
      cacheControl: STORAGE_UPLOAD_CACHE_CONTROL,
    });
    if (uploadError) {
      return NextResponse.json({ error: `Качването неуспешно: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl ?? null;
    if (!publicUrl) {
      return NextResponse.json({ error: "URL на изображението не е достъпен." }, { status: 500 });
    }

    const inserted = await insertGalleryRowAndMarkEdited(admin, festivalId, publicUrl);
    if (!inserted.ok) return inserted.response;

    await logOrganizerMediaAction(session.user.id, festivalId, gate.organizerId, "added", publicUrl);
    return NextResponse.json({ ok: true, row: inserted.row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Грешка при качване.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
