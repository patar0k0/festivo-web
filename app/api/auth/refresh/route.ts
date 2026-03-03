import { NextResponse } from "next/server";

const MESSAGE = "Legacy endpoint removed. Supabase handles refresh via sb-* session cookies.";

export async function GET() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}
