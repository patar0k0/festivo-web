import { describe, it, expect } from "vitest";
import {
  parseOutreachDedupeKey,
  buildOutreachContactedMap,
  classifyOutreachStatus,
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
