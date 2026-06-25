import { describe, it, expect, vi } from "vitest";

const hasActiveOrganizerMembershipMock = vi.fn();
vi.mock("@/lib/organizer/portal", () => ({
  hasActiveOrganizerMembership: (...args: unknown[]) => hasActiveOrganizerMembershipMock(...args),
}));

import { assertOrganizerCanEditPublishedFestival } from "./festivalSelfEdit";

type Row = Record<string, unknown>;

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.order = vi.fn(chain);
  query.limit = vi.fn(chain);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  return query;
}

function makeAdmin(opts: {
  festival: { data: Row | null; error: unknown };
  festivalOrganizersLink?: { data: Row | null; error: unknown };
}) {
  return {
    from(table: string) {
      if (table === "festivals") return makeQuery(opts.festival);
      if (table === "festival_organizers") return makeQuery(opts.festivalOrganizersLink ?? { data: null, error: null });
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as never;
}

describe("assertOrganizerCanEditPublishedFestival", () => {
  it("returns 404 when the festival does not exist", async () => {
    const admin = makeAdmin({ festival: { data: null, error: null } });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 404, error: "Фестивалът не е намерен." });
  });

  it("returns 404 when neither festivals.organizer_id nor festival_organizers has an owner", async () => {
    const admin = makeAdmin({
      festival: { data: { organizer_id: null, status: "verified" }, error: null },
      festivalOrganizersLink: { data: null, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 404, error: "Фестивалът не е намерен." });
  });

  it("returns 403 when the festival is not verified/published", async () => {
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "draft" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 403, error: "Можете да редактирате само одобрени фестивали." });
  });

  it("returns 403 when the user has no active organizer membership", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(false);
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "verified" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: false, status: 403, error: "Нямате права за този фестивал." });
  });

  it("returns ok with the organizer id when membership is active and the festival is published", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(true);
    const admin = makeAdmin({
      festival: { data: { organizer_id: "org-1", status: "verified" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: true, organizerId: "org-1" });
  });

  it("falls back to festival_organizers when festivals.organizer_id is null", async () => {
    hasActiveOrganizerMembershipMock.mockResolvedValueOnce(true);
    const admin = makeAdmin({
      festival: { data: { organizer_id: null, status: "verified" }, error: null },
      festivalOrganizersLink: { data: { organizer_id: "org-2" }, error: null },
    });
    const result = await assertOrganizerCanEditPublishedFestival(admin, "user-1", "festival-1");
    expect(result).toEqual({ ok: true, organizerId: "org-2" });
  });
});
