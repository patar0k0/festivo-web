import { NextResponse } from "next/server";

/**
 * Health check endpoint for uptime monitoring (UptimeRobot, etc.)
 * Returns 200 OK with basic status info. No DB queries — intentionally lightweight.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
