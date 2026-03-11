const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const { extractLocation } = require("./ingest_fb_event");

const fixturesPath = path.join(__dirname, "location_parsing_regression_fixtures.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));

for (const fixture of fixtures) {
  const result = extractLocation(fixture.input);
  assert.equal(result.location_name ?? null, fixture.expected.location_name ?? null, `${fixture.name}: location_name`);
  assert.equal(result.address ?? null, fixture.expected.address ?? null, `${fixture.name}: address`);
}

console.log(`location parsing regression fixtures passed (${fixtures.length})`);
