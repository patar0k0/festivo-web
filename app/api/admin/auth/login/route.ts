import { NextResponse } from "next/server";

function toUserLogin(request: Request) {
  return NextResponse.redirect(new URL("/api/auth/login", request.url));
}

export async function GET(request: Request) {
  return toUserLogin(request);
}

export async function POST(request: Request) {
  return toUserLogin(request);
}
