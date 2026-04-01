import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  emailMatchesQuery,
  enrichUsersForAdminList,
  userToAdminListRow,
  type AdminUserListRow,
} from "@/lib/admin/adminUsersList";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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

function needsFullUserScan(params: { q: string; role: string; hasOrganizer: string; banned: string }): boolean {
  return (
    params.q.length > 0 ||
    params.role === "admin" ||
    params.hasOrganizer === "1" ||
    params.banned === "1"
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

function applyPostEnrichmentFilters(
  rows: AdminUserListRow[],
  params: { role: string; hasOrganizer: string; banned: string },
): AdminUserListRow[] {
  let out = rows;
  if (params.role === "admin") {
    out = out.filter((r) => r.is_admin);
  }
  if (params.hasOrganizer === "1") {
    out = out.filter((r) => r.organizer_count > 0);
  }
  if (params.banned === "1") {
    out = out.filter((r) => r.banned_until && new Date(r.banned_until) > new Date());
  }
  return out;
}

function sortByCreatedDesc(rows: AdminUserListRow[]): AdminUserListRow[] {
  return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  const scan = needsFullUserScan({ q, role, hasOrganizer, banned });

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
      const rows: AdminUserListRow[] = users.map((u) =>
        userToAdminListRow(u, enrich.get(u.id) ?? { is_admin: false, organizer_count: 0, pending_claim_count: 0 }),
      );

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
    if (q) {
      candidates = candidates.filter((u) => emailMatchesQuery(u.email ?? null, q));
    }

    const enrich = await enrichUsersForAdminList(
      adminClient,
      candidates.map((u) => u.id),
    );

    let rows: AdminUserListRow[] = candidates.map((u) =>
      userToAdminListRow(u, enrich.get(u.id) ?? { is_admin: false, organizer_count: 0, pending_claim_count: 0 }),
    );

    rows = applyPostEnrichmentFilters(rows, { role, hasOrganizer, banned });
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
