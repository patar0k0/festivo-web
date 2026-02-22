import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "festivo_preview";

export function middleware(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const { pathname, searchParams } = nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/coming-soon") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const secret = process.env.FESTIVO_PREVIEW_SECRET;

  if (searchParams.get("preview") && secret && searchParams.get("preview") === secret) {
    const url = nextUrl.clone();
    url.searchParams.delete("preview");
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, "1", {
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    response.headers.set("x-festivo-gate", "unlocked");
    return response;
  }

  if (searchParams.get("logout") === "1") {
    const url = nextUrl.clone();
    url.searchParams.delete("logout");
    url.pathname = "/";
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (cookies.get(COOKIE_NAME)?.value === "1") {
    const response = NextResponse.next();
    response.headers.set("x-festivo-gate", "bypass-cookie");
    return response;
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = "/coming-soon";
  rewriteUrl.search = "";
  const response = NextResponse.rewrite(rewriteUrl);
  response.headers.set("x-festivo-gate", "locked");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
