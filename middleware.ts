import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/cities/")) {
    const cityPart = pathname.slice("/cities/".length).replace(/\/+$/, "");
    if (cityPart && /[А-Яа-я]/.test(cityPart)) {
      const cityMap: Record<string, string> = {
        "софия": "sofia",
        "пловдив": "plovdiv",
        "варна": "varna",
        "бургас": "burgas",
        "русе": "ruse",
        "стара-загора": "stara-zagora",
        "плевен": "pleven",
        "велико-търново": "veliko-tarnovo",
      };
      const decodedCity = decodeURIComponent(cityPart).toLowerCase();
      const mappedCity = cityMap[decodedCity];
      if (mappedCity) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/cities/${mappedCity}`;
        return NextResponse.redirect(redirectUrl, 301);
      }
    }
  }

  const comingSoonMode = process.env.FESTIVO_PUBLIC_MODE === "coming-soon";
  const hasPreviewAccess = Boolean(request.cookies.get("festivo_preview")?.value);
  const isAllowlisted =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/logout-preview") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (comingSoonMode && !hasPreviewAccess && pathname !== "/" && !isAllowlisted) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico$|robots.txt$|sitemap.xml$|.*\\..*).*)"],
};
