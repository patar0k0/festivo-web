import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const AVATARS_BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Avatar upload is not configured." }, { status: 503 });
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

  const mime = file.type;
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    return NextResponse.json({ error: "Allowed formats: JPG, PNG, WebP." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maximum file size is 2 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty file." }, { status: 400 });
  }

  const folder = user.id;
  const objectPath = `${folder}/avatar.${ext}`;

  const { data: existing, error: listError } = await admin.storage.from(AVATARS_BUCKET).list(folder, {
    limit: 100,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  if (existing?.length) {
    const paths = existing.map((item) => `${folder}/${item.name}`);
    const { error: removeError } = await admin.storage.from(AVATARS_BUCKET).remove(paths);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  const { error: uploadError } = await admin.storage.from(AVATARS_BUCKET).upload(objectPath, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData.publicUrl;

  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: publicUrl });
}
