import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/admin/isAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function redirectWithError(request: Request, message: string) {
  const url = new URL(request.url);
  const loginUrl = new URL("/admin/login", url);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return redirectWithError(request, "Невалидни данни за вход.");
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return redirectWithError(request, "Липсва Supabase конфигурация.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return redirectWithError(request, "Невалидни данни за вход.");
  }

  const adminDb = supabaseAdmin() ?? supabase;
  const { data: roleData, error: roleError } = await adminDb
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !roleData) {
    return redirectWithError(request, "Нямаш admin достъп.");
  }

  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/admin", url));
  response.cookies.set(ADMIN_AUTH_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
