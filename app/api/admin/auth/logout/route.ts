import { NextResponse } from "next/server";

function toUserLogout(request: Request) {
  return NextResponse.redirect(new URL("/api/auth/logout", request.url));
}

export async function GET(request: Request) {
  return toUserLogout(request);
}

export async function POST(request: Request) {
  return toUserLogout(request);
}
