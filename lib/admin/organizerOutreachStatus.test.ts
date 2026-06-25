import { describe, it, expect, vi } from "vitest";
import {
  parseOutreachDedupeKey,
  buildOutreachContactedMap,
  classifyOutreachStatus,
  fetchAllOrganizerOutreachContactedMap,
} from "./organizerOutreachStatus";

describe("parseOutreachDedupeKey", () => {
  it("extracts the organizer id from a well-formed key", () => {
    expect(
      parseOutreachDedupeKey("organizer-outreach:org-123:contact@example.bg:2026-06-20"),
    ).toBe("org-123");
  });

  it("returns null for a key with the wrong prefix", () => {
    expect(parseOutreachDedupeKey("festival-approved:abc:2026-06-20")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseOutreachDedupeKey(null)).toBeNull();
  });

  it("returns null when the organizer id segment is empty", () => {
    expect(parseOutreachDedupeKey("organizer-outreach::contact@example.bg:2026-06-20")).toBeNull();
  });
});

describe("buildOutreachContactedMap", () => {
  it("maps organizer id to created_at for a single matching row", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(map.get("org-1")).toBe("2026-06-01T10:00:00Z");
  });

  it("keeps the most recent created_at when an organizer has multiple rows", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-20", created_at: "2026-06-20T08:00:00Z" },
    ]);
    expect(map.get("org-1")).toBe("2026-06-20T08:00:00Z");
  });

  it("ignores rows with an unparsable dedupe_key", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "welcome-email:user-1:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: null, created_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(map.size).toBe(0);
  });

  it("tracks separate organizers independently", () => {
    const map = buildOutreachContactedMap([
      { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
      { dedupe_key: "organizer-outreach:org-2:c@d.bg:2026-06-02", created_at: "2026-06-02T10:00:00Z" },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("org-2")).toBe("2026-06-02T10:00:00Z");
  });
});

describe("classifyOutreachStatus", () => {
  it("returns contacted when the organizer is in the map, regardless of current email", () => {
    const map = new Map([["org-1", "2026-06-20T08:00:00Z"]]);
    expect(classifyOutreachStatus(null, "org-1", map)).toEqual({
      status: "contacted",
      lastContactedAt: "2026-06-20T08:00:00Z",
    });
  });

  it("returns no_email when there is no email and no contact history", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus(null, "org-2", map)).toEqual({
      status: "no_email",
      lastContactedAt: null,
    });
  });

  it("returns no_email when email is an empty/whitespace string", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus("   ", "org-2", map)).toEqual({
      status: "no_email",
      lastContactedAt: null,
    });
  });

  it("returns not_contacted when there is an email but no contact history", () => {
    const map = new Map<string, string>();
    expect(classifyOutreachStatus("org@example.bg", "org-3", map)).toEqual({
      status: "not_contacted",
      lastContactedAt: null,
    });
  });
});

describe("fetchAllOrganizerOutreachContactedMap", () => {
  type Row = { dedupe_key: string | null; created_at: string };

  /** Minimal fake mimicking the .from().select().eq().range() chain this function uses. */
  function makeClient(pages: { data: Row[] | null; error: unknown }[]) {
    let call = 0;
    const rangeCalls: Array<[number, number]> = [];
    const client = {
      from(table: string) {
        if (table !== "email_jobs") throw new Error(`unexpected table: ${table}`);
        const query: Record<string, unknown> = {};
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.range = vi.fn((from: number, to: number) => {
          rangeCalls.push([from, to]);
          const result = pages[call] ?? { data: [], error: null };
          call += 1;
          return Promise.resolve(result);
        });
        return query;
      },
    };
    return { client, rangeCalls };
  }

  it("aggregates rows across multiple pages and stops once a short page is returned", async () => {
    const { client, rangeCalls } = makeClient([
      {
        data: [
          { dedupe_key: "organizer-outreach:org-1:a@b.bg:2026-06-01", created_at: "2026-06-01T10:00:00Z" },
          { dedupe_key: "organizer-outreach:org-2:c@d.bg:2026-06-02", created_at: "2026-06-02T10:00:00Z" },
        ],
        error: null,
      },
      {
        data: [
          { dedupe_key: "organizer-outreach:org-3:e@f.bg:2026-06-03", created_at: "2026-06-03T10:00:00Z" },
        ],
        error: null,
      },
    ]);

    const map = await fetchAllOrganizerOutreachContactedMap(client as never, 2);

    expect(map.size).toBe(3);
    expect(map.get("org-3")).toBe("2026-06-03T10:00:00Z");
    expect(rangeCalls).toEqual([[0, 1], [2, 3]]);
  });

  it("returns an empty map when there are no outreach jobs", async () => {
    const { client } = makeClient([{ data: [], error: null }]);
    const map = await fetchAllOrganizerOutreachContactedMap(client as never, 2);
    expect(map.size).toBe(0);
  });

  it("throws when the underlying query errors", async () => {
    const { client } = makeClient([{ data: null, error: { message: "boom" } }]);
    await expect(fetchAllOrganizerOutreachContactedMap(client as never, 2)).rejects.toThrow("boom");
  });
});
