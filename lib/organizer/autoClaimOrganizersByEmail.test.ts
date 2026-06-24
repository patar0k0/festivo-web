import { describe, it, expect, vi } from "vitest";
import { attemptOrganizerAutoClaimByEmail } from "./autoClaimOrganizersByEmail";

// absoluteSiteUrl() (used for the email payload URLs) reads this synchronously and
// throws if unset — vitest doesn't load .env.local, so stub it for this test file.
process.env.NEXT_PUBLIC_SITE_URL ??= "https://festivo.bg";

type Row = Record<string, unknown>;

/** Minimal chainable fake mimicking the subset of the supabase-js query builder this module uses. */
function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = vi.fn(chain);
  query.eq = vi.fn(chain);
  query.in = vi.fn(chain);
  query.ilike = vi.fn(chain);
  query.insert = vi.fn(() => Promise.resolve(result));
  query.update = vi.fn(chain);
  // The real builder is thenable; `await query` resolves to `{ data, error }` once all
  // filters are applied. We model that by making the chain itself awaitable.
  query.then = (resolve: (v: typeof result) => void) => resolve(result);
  return query;
}

function makeAdmin(opts: {
  organizers: { data: Row[] | null; error: unknown };
  organizerMembersSelect: { data: Row[] | null; error: unknown };
  insertResult?: { data: null; error: unknown };
  updateResult?: { data: null; error: unknown };
}) {
  const calls: string[] = [];
  return {
    from(table: string) {
      calls.push(table);
      if (table === "organizers" && calls.filter((t) => t === "organizers").length === 1) {
        return makeQuery(opts.organizers);
      }
      if (table === "organizer_members" && !calls.includes("__member_insert_done__")) {
        // First organizer_members call = the owner-lookup select.
        if (calls.filter((t) => t === "organizer_members").length === 1) {
          return makeQuery(opts.organizerMembersSelect);
        }
        // Second organizer_members call = the insert.
        calls.push("__member_insert_done__");
        return makeQuery(opts.insertResult ?? { data: null, error: null });
      }
      if (table === "organizers") {
        // Second organizers call = the verified=true update.
        return makeQuery(opts.updateResult ?? { data: null, error: null });
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as never;
}

describe("attemptOrganizerAutoClaimByEmail", () => {
  it("returns claimed:false when no organizer matches the email", async () => {
    const admin = makeAdmin({
      organizers: { data: [], error: null },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "nobody@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("returns claimed:false when 2+ unclaimed organizers match the same email", async () => {
    const admin = makeAdmin({
      organizers: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-one" },
          { id: "org-2", name: "Org Two", slug: "org-two" },
        ],
        error: null,
      },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "shared@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("returns claimed:false when the single matching organizer already has an active owner", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [{ organizer_id: "org-1" }], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "claimed@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("grants ownership when exactly one unclaimed organizer matches", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [], error: null },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "Match@Example.BG");
    expect(result).toEqual({
      claimed: true,
      organizerId: "org-1",
      organizerName: "Org One",
      organizerSlug: "org-one",
    });
  });

  it("returns claimed:false (not throw) on a unique-violation race during insert", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [], error: null },
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "race@example.bg");
    expect(result).toEqual({ claimed: false });
  });

  it("still returns claimed:true even if building notification URLs throws (e.g. missing NEXT_PUBLIC_SITE_URL)", async () => {
    const admin = makeAdmin({
      organizers: { data: [{ id: "org-1", name: "Org One", slug: "org-one" }], error: null },
      organizerMembersSelect: { data: [], error: null },
    });
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      const result = await attemptOrganizerAutoClaimByEmail(admin, "user-1", "url-failure@example.bg");
      expect(result).toEqual({
        claimed: true,
        organizerId: "org-1",
        organizerName: "Org One",
        organizerSlug: "org-one",
      });
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });
});
