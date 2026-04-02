import { FESTIVAL_PATCH_ALLOWED_KEYS, ORGANIZER_PATCH_ALLOWED_KEYS } from "../lib/admin/patchAllowedKeys";
import { validateNoUnknownKeys } from "../lib/api/strictBody";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function run() {
  const organizerKnown = validateNoUnknownKeys({ name: "Org Name" }, ORGANIZER_PATCH_ALLOWED_KEYS);
  assert(organizerKnown.ok, "organizers: known key should pass");

  const organizerUnknown = validateNoUnknownKeys({ random_col: 1 }, ORGANIZER_PATCH_ALLOWED_KEYS);
  assert(!organizerUnknown.ok, "organizers: unknown key should fail");

  const organizerMixed = validateNoUnknownKeys({ name: "Org Name", created_at: "2026-01-01" }, ORGANIZER_PATCH_ALLOWED_KEYS);
  assert(!organizerMixed.ok, "organizers: mixed known + unknown should fail");

  const festivalKnown = validateNoUnknownKeys({ title: "Festival" }, FESTIVAL_PATCH_ALLOWED_KEYS);
  assert(festivalKnown.ok, "festivals: known key should pass");

  const festivalUnknown = validateNoUnknownKeys({ is_admin: true }, FESTIVAL_PATCH_ALLOWED_KEYS);
  assert(!festivalUnknown.ok, "festivals: unknown key should fail");

  const festivalMixed = validateNoUnknownKeys({ title: "Festival", updated_at: "2026-01-01" }, FESTIVAL_PATCH_ALLOWED_KEYS);
  assert(!festivalMixed.ok, "festivals: mixed known + unknown should fail");

  console.log("strict unknown-key checks passed");
}

run();
