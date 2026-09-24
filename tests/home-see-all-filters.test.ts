import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeSectionSeeAllHref } from "../shared/homeSectionHref";
import { matchesAudience, selectedAudienceIds } from "../shared/audienceFilters";

test("home See all keeps category and all audience filters only", () => {
  const href = buildHomeSectionSeeAllHref({
    categoryFilters: ["towels"],
    audienceFilters: ["infant", "kids", "teens"],
  });

  assert.equal(href, "/shop?category=towels&filter=infant%2Ckids%2Cteens");
  assert.equal(href.includes("gender="), false);
  assert.equal(href.includes("theme="), false);
  assert.equal(href.includes("style="), false);
});

test("multiple audience IDs match products with OR semantics", () => {
  assert.deepEqual(selectedAudienceIds("infant,kids,teens"), ["infant", "kids", "teens"]);
  assert.equal(matchesAudience(["infant"], "infant,kids,teens"), true);
  assert.equal(matchesAudience(["kids"], "infant,kids,teens"), true);
  assert.equal(matchesAudience(["adults"], "infant,kids,teens"), false);
  assert.equal(matchesAudience(["adults"], "all"), true);
});