import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { getActiveSerpApiKeyIndex, toggleSerpApiKeyIndex } from "@/lib/admin/serpApiConfig.server";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const active = await getActiveSerpApiKeyIndex();
  return NextResponse.json({ active });
}

export async function POST() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const next = await toggleSerpApiKeyIndex();
  return NextResponse.json({ active: next });
}
