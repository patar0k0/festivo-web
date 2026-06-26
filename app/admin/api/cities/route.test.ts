import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.fn();
const mockFrom = vi.fn();
const mockLogAdminAction = vi.fn();

vi.mock("@/lib/admin/isAdmin", () => ({
  getAdminContext: () => mockGetAdminContext(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdmin: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/admin/audit-log", () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
}));

import { GET, PATCH } from "./route";

function adminCtx() {
  return { supabase: {}, client: {}, user: { id: "admin-1" }, isAdmin: true as const };
}

beforeEach(() => {
  mockGetAdminContext.mockReset();
  mockFrom.mockReset();
  mockLogAdminAction.mockReset();
});

describe("GET /admin/api/cities", () => {
  it("returns 403 when not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns cities sorted by name_bg (bg-BG locale)", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const rows = [
      { id: 2, name_bg: "Ябълково", slug: "yabalkovo", region: null, is_village: true },
      { id: 1, name_bg: "Айтос", slug: "aytos", region: null, is_village: false },
    ];
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: rows, error: null }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cities.map((c: { name_bg: string }) => c.name_bg)).toEqual(["Айтос", "Ябълково"]);
  });

  it("returns 500 when the query fails", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /admin/api/cities", () => {
  function patchRequest(body: unknown) {
    return new Request("http://localhost/admin/api/cities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 403 when not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when is_village is not boolean|null", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ id: 1, is_village: "true" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when id is missing or not a number", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const res = await PATCH(patchRequest({ is_village: true }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the city does not exist", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const res = await PATCH(patchRequest({ id: 999, is_village: true }));
    expect(res.status).toBe(404);
  });

  it("updates is_village, logs the audit action, and returns 200 on success", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    const updateEq = vi.fn(() => Promise.resolve({ error: null }));
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 1, is_village: false }, error: null }),
        }),
      }),
      update: () => ({ eq: updateEq }),
    });

    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith("id", 1);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_is_village",
        entity_type: "city",
        entity_id: "1",
        details: { from: false, to: true },
      }),
    );
  });

  it("returns 500 when the update fails", async () => {
    mockGetAdminContext.mockResolvedValue(adminCtx());
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 1, is_village: false }, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: "boom" } }) }),
    });

    const res = await PATCH(patchRequest({ id: 1, is_village: true }));
    expect(res.status).toBe(500);
  });
});
