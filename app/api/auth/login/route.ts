import { NextResponse } from "next/server";

const MESSAGE = "Legacy endpoint removed. Use Supabase auth session directly.";

export async function GET() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}
