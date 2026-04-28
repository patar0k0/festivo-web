import { NextResponse } from "next/server";
import {
  deleteOrganizerLogoFromStorageIfOwned,
  uploadOrganizerLogoFromUploadedBuffer,
  takeOrganizerLogoUploadRateLimit,
} from "@/lib/admin/normalizeImageToLocalStorage";
import { assertCanEditOrganizer } from "@/lib/organizer/permissions";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

const MAX_BYTES = 2 * 1024 * 1024;
const ORGANIZER_LOGOS_PUBLIC_PREFIX = "/storage/v1/object/public/organizer-logos/";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { id } = await params;

  try {
    await assertCanEditOrganizer(admin, session.user.id, id);
  } catch (error) {
    if (error instanceof Error && error.name === "OrganizerPermissionError") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/organizers/[id]/logo] permission check failed", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const { data: current, error: currentError } = await admin.from("organizers").select("logo_url").eq("id", id).single();
  if (currentError) {
    console.error("[api/organizers/[id]/logo] failed to fetch current organizer logo", currentError);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  if (takeOrganizerLogoUploadRateLimit(clientIp(request))) {
    return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Файлът трябва да е изображение" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Максимален размер 2MB" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read file." }, { status: 400 });
  }

  try {
    const newUrl = await uploadOrganizerLogoFromUploadedBuffer(buffer, file.type);
    const { error: updateError } = await admin.from("organizers").update({ logo_url: newUrl }).eq("id", id).eq("is_active", true);
    if (updateError) {
      console.error("[api/organizers/[id]/logo] failed to persist organizer logo", updateError);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    if (current?.logo_url && current.logo_url !== newUrl) {
      try {
        const oldLogoUrl = current.logo_url;
        if (!oldLogoUrl?.includes("/storage/v1/object/public/")) {
          return NextResponse.json({ url: newUrl });
        }
        if (!oldLogoUrl.includes(ORGANIZER_LOGOS_PUBLIC_PREFIX)) {
          return NextResponse.json({ url: newUrl });
        }
        await deleteOrganizerLogoFromStorageIfOwned(oldLogoUrl, oldLogoUrl);
      } catch {
        // best-effort cleanup: upload/update should succeed even if delete fails
      }
    }

    return NextResponse.json({ url: newUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[api/organizers/[id]/logo]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
