import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login?next=/admin", request.url));
}

export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/login?next=/admin", request.url));
}
