import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "festivo_preview";

export function middleware(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const { pathname, searchParams } = nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/coming-soon") {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  const secret = process.env.FESTIVO_PREVIEW_SECRET;
  const preview = searchParams.get("preview");
  if (secret && preview && preview === secret) {
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
    return response;
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = "/coming-soon";
  rewriteUrl.search = "";
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots.txt|sitemap.xml).*)"],
};
