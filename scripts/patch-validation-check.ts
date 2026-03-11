import { festivalPatchFromCanonicalPartial, pendingPatchFromCanonicalPartial } from "../lib/festival/mappers";
import { canonicalPatchFromUnknown } from "../lib/festival/validators";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function parse(payload: Record<string, unknown>) {
  const parsed = canonicalPatchFromUnknown(payload);
  if (!parsed.ok) {
    throw new Error(`expected parse success for payload keys=${Object.keys(payload).join(",")} error=${parsed.error}`);
  }
  return parsed.data;
}

function run() {
  const titleOnly = parse({ title: "Updated title" });
  const titlePatch = festivalPatchFromCanonicalPartial(titleOnly);
  assert(titlePatch.title === "Updated title", "title-only patch should include title");
  assert(!("tags" in titlePatch), "title-only patch should not include tags");

  const tagsOnly = parse({ tags: ["folk", "summer"] });
  const pendingTagsPatch = pendingPatchFromCanonicalPartial(tagsOnly);
  assert(Array.isArray(pendingTagsPatch.tags), "tags-only patch should include tags array");
  assert(!("title" in pendingTagsPatch), "tags-only patch should not include title");

  const explicitNulls = parse({ hero_image: null, source_url: null, tags: null });
  const nullPatch = festivalPatchFromCanonicalPartial(explicitNulls);
  assert(nullPatch.hero_image === null, "explicit null should clear hero_image");
  assert(nullPatch.image_url === null, "explicit null should clear image_url mirror");
  assert(nullPatch.source_url === null, "explicit null should clear source_url");
  assert(nullPatch.tags === null, "explicit null should clear tags");

  const omittedFields = parse({ title: "Only title" });
  const omittedPatch = pendingPatchFromCanonicalPartial(omittedFields);
  assert(!("description" in omittedPatch), "omitted description should remain untouched");
  assert(!("start_date" in omittedPatch), "omitted start_date should remain untouched");

  console.log("patch semantics checks passed");
}

run();
