import { describe, it, expect } from "vitest";
import { FESTIVAL_PATCH_ALLOWED_KEYS, ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS } from "./patchAllowedKeys";

describe("ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS", () => {
  it("is a subset of FESTIVAL_PATCH_ALLOWED_KEYS", () => {
    const adminSet = new Set(FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS) {
      expect(adminSet.has(key)).toBe(true);
    }
  });

  it("excludes admin-only fields", () => {
    const excluded = [
      "slug",
      "status",
      "is_verified",
      "organizer_id",
      "organizer_ids",
      "organizer_name",
      "organizer_entries",
      "source_url",
      "source_type",
      "promotion_status",
      "promotion_started_at",
      "promotion_expires_at",
      "promotion_rank",
    ];
    const orgSet = new Set(ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of excluded) {
      expect(orgSet.has(key as never)).toBe(false);
    }
  });

  it("includes the core editable fields", () => {
    const orgSet = new Set(ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS as readonly string[]);
    for (const key of ["title", "description", "city_id", "start_date", "hero_image", "occurrence_dates", "is_free"]) {
      expect(orgSet.has(key as never)).toBe(true);
    }
  });
});
