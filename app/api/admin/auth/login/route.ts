import { NextResponse } from "next/server";

function toUserLogin(request: Request) {
  const url = new URL(request.url);
  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("next", "/admin");
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  return toUserLogin(request);
}

export async function POST(request: Request) {
  return toUserLogin(request);
}
