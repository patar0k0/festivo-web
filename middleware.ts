import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PREVIEW_COOKIE_NAME = "festivo_preview";

export function middleware(request: NextRequest) {
  const previewToken = process.env.PREVIEW_TOKEN;
  const cookieValue = request.cookies.get(PREVIEW_COOKIE_NAME)?.value;
  const hasPreviewAccess = Boolean(previewToken) && cookieValue === previewToken;

  if (hasPreviewAccess) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = "/coming-soon";
  rewriteUrl.search = "";
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/"],
};
