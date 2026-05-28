import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import type { User } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  emailMatchesQuery,
  enrichUsersForAdminList,
  lastSignInMatchesLastLoginFilter,
  nameMatchesQuery,
  userToAdminListRow,
  type AdminUserListRow,
} from "@/lib/admin/adminUsersList";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAppRoleValue } from "@/lib/admin/appRoles";

const INTERNAL_PAGE_SIZE = 200;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

function asString(value: string | null) {
  return typeof value === "string" ? value : "";
}

function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (max != null && n > max) return max;
  return n;
}

function needsFullUserScan(params: {
  q: string;
  role: string;
  hasOrganizer: string;
  banned: string;
  status: string;
  lastLogin: string;
}): boolean {
  return (
    params.q.length > 0 ||
    (params.role !== "" && params.role !== "all") ||
    params.hasOrganizer === "1" ||
    params.banned === "1" ||
    params.status === "deleted" ||
    params.status === "all" ||
    (params.lastLogin !== "" && params.lastLogin !== "all")
  );
}

async function fetchAllAuthUsers(adminClient: ReturnType<typeof createSupabaseAdmin>): Promise<User[]> {
  const all: User[] = [];
  let authPage = 1;
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: authPage, perPage: INTERNAL_PAGE_SIZE });
    if (error) {
      throw new Error(error.message);
    }
    const users = data.users ?? [];
    all.push(...users);
    if (users.length < INTERNAL_PAGE_SIZE) break;
    authPage += 1;
    if (authPage > 500) {
      console.warn("[admin/api/users] auth user list truncated at page cap");
      break;
    }
  }
  return all;
}

function applyListFilters(rows: AdminUserListRow[], params: { role: string; hasOrganizer: string; banned: string; lastLogin: string; status: string }): AdminUserListRow[] {
  let out = rows;

  const st = params.status;
  if (st === "active" || st === "") {
    out = out.filter((r) => !r.deleted_at);
  } else if (st === "deleted") {
    out = out.filter((r) => Boolean(r.deleted_at));
  }

  if (params.role && params.role !== "all") {
    if (isAppRoleValue(params.role)) {
      out = out.filter((r) => r.app_role === params.role);
    }
  }

  if (params.hasOrganizer === "1") {
    out = out.filter((r) => r.organizer_count > 0);
  }

  if (params.banned === "1") {
    out = out.filter((r) => r.banned_active);
  }

  if (params.lastLogin === "recent" || params.lastLogin === "stale") {
    const lf = params.lastLogin as "recent" | "stale";
    out = out.filter((r) => lastSignInMatchesLastLoginFilter(r.last_sign_in_at ?? null, lf));
  }

  return out;
}

function sortByCreatedDesc(rows: AdminUserListRow[]): AdminUserListRow[] {
  return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function filterCandidatesBySearch(users: User[], q: string): User[] {
  const needle = q.trim();
  if (!needle) return users;
  return users.filter((u) => emailMatchesQuery(u.email ?? null, needle) || nameMatchesQuery(u, needle));
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/users] Admin client initialization failed", { message });
    return NextResponse.json({ error: "User list is temporarily unavailable." }, { status: 500 });
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const perPage = parsePositiveInt(url.searchParams.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const q = asString(url.searchParams.get("q")).trim();
  const role = asString(url.searchParams.get("role"));
  const hasOrganizer = asString(url.searchParams.get("has_organizer"));
  const banned = asString(url.searchParams.get("banned"));
  const status = asString(url.searchParams.get("status"));
  const lastLogin = asString(url.searchParams.get("last_login"));

  const scan = needsFullUserScan({ q, role, hasOrganizer, banned, status, lastLogin: lastLogin });

  try {
    if (!scan) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        throw new Error(error.message);
      }
      const users = data.users ?? [];
      const apiTotal = typeof data.total === "number" && data.total > 0 ? data.total : 0;

      const enrich = await enrichUsersForAdminList(
        adminClient,
        users.map((u) => u.id),
      );
      let rows: AdminUserListRow[] = users.map((u) =>
        userToAdminListRow(
          u,
          enrich.get(u.id) ?? {
            is_admin: false,
            app_role: "user",
            deleted_at: null,
            banned_until_db: null,
            organizer_count: 0,
            pending_claim_count: 0,
          },
        ),
      );

      rows = applyListFilters(rows, { role, hasOrganizer, banned, lastLogin, status: status || "active" });

      let total = apiTotal;
      if (total <= 0) {
        if (users.length < perPage) {
          total = (page - 1) * perPage + users.length;
        } else {
          total = page * perPage;
        }
      }

      return NextResponse.json({ rows, total, page, perPage });
    }

    const allUsers = await fetchAllAuthUsers(adminClient);

    let candidates = allUsers;
    candidates = filterCandidatesBySearch(candidates, q);

    const enrich = await enrichUsersForAdminList(
      adminClient,
      candidates.map((u) => u.id),
    );

    let rows: AdminUserListRow[] = candidates.map((u) =>
      userToAdminListRow(
        u,
        enrich.get(u.id) ?? {
          is_admin: false,
          app_role: "user",
          deleted_at: null,
          banned_until_db: null,
          organizer_count: 0,
          pending_claim_count: 0,
        },
      ),
    );

    rows = applyListFilters(rows, { role, hasOrganizer, banned, lastLogin, status });
    rows = sortByCreatedDesc(rows);

    const total = rows.length;
    const start = (page - 1) * perPage;
    const pageRows = rows.slice(start, start + perPage);

    return NextResponse.json({ rows: pageRows, total, page, perPage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[admin/api/users] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
