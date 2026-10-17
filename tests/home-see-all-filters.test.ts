import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeSectionSeeAllHref, buildHomepageCardHref } from "../shared/homeSectionHref";
import { matchesAudience, selectedAudienceIds } from "../shared/audienceFilters";
import { productMatchesFilters } from "../shared/productFilters";
import type { Category, Product } from "../shared/types";

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

test("homepage cards use configured filters for their shop destination", () => {
  assert.equal(buildHomepageCardHref({
    link: "/shop",
    categoryFilters: ["towels"],
    audienceFilters: ["kids", "infant"],
    genderFilters: ["female"],
    themeFilters: ["unicorn"],
    styleFilters: ["bold"],
    tagFilters: ["Best Sellers"],
  }), "/shop?category=towels&filter=kids%2Cinfant&gender=female&theme=unicorn&style=bold&productTag=Best+Sellers");
});

test("homepage cards preserve custom links when no filters are configured", () => {
  assert.equal(buildHomepageCardHref({
    link: "/collection/couples",
    categoryFilters: [],
    audienceFilters: [],
  }), "/collection/couples");
});

test("configured category, audience, and product-tag filters match only the intended products", () => {
  const categories = [{ id: "blankets-id", name: "Blankets", slug: "blankets" }] as Category[];
  const blanket = {
    active: true, categoryId: "blankets-id", audience: ["kids-id"], genders: ["female-id"],
    themes: [], styles: [], tagNames: ["Warm"],
  } as Product;
  const towel = {
    active: true, categoryId: "towels-id", audience: ["kids-id"], genders: ["female-id"],
    themes: [], styles: [], tagNames: ["Warm"],
  } as Product;
  const filters = {
    categoryFilters: ["blankets"], audienceFilters: ["kids-id"],
    genderFilters: ["female-id"], tagFilters: ["Warm"],
  };

  assert.equal(productMatchesFilters(blanket, categories, filters), true);
  assert.equal(productMatchesFilters(towel, categories, filters), false);
  assert.equal(productMatchesFilters(blanket, categories, { ...filters, tagFilters: ["Not warm"] }), false);
});