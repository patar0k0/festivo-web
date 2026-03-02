import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/admin/isAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function redirectWithError(request: Request, message: string) {
  const url = new URL(request.url);
  const loginUrl = new URL("/admin/login", url);
  loginUrl.searchParams.set("error", message);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return redirectWithError(request, "invalid_credentials");
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return redirectWithError(request, "supabase_not_configured");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return redirectWithError(request, "invalid_credentials");
  }

  const adminDb = supabaseAdmin() ?? supabase;
  const { data: roleData, error: roleError } = await adminDb
    .from("user_roles")
    .select("user_id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !roleData) {
    await supabase.auth.signOut();
    return redirectWithError(request, "not_admin");
  }

  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/admin", url));
  response.cookies.set(ADMIN_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
