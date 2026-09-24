import assert from "node:assert/strict";
import test from "node:test";
import { getProductSearchTerms, matchesProductSearch } from "../shared/productSearch";

test("splits multi-word product searches into normalized terms", () => {
  assert.deepEqual(getProductSearchTerms("  Kids   TOWEL  "), ["kids", "towel"]);
});

test("matches every query term even when words are separated in the product title", () => {
  assert.equal(
    matchesProductSearch("kids towel", {
      name: "Personalized Kids Bath Towel",
      sku: "TL-001",
      description: "Soft cotton",
    }),
    true,
  );
});

test("requires all query terms to occur in searchable product fields", () => {
  assert.equal(
    matchesProductSearch("kids towel", {
      name: "Personalized Kids Bath Robe",
      sku: "TL-001",
      description: "Soft cotton",
    }),
    false,
  );
});

test("matches terms across the existing searchable fields", () => {
  assert.equal(
    matchesProductSearch("kids towel", {
      name: "Personalized Kids Bath Robe",
      sku: "TL-001",
      description: "Includes a soft towel",
    }),
    true,
  );
});

test("does not match an empty search", () => {
  assert.equal(matchesProductSearch("   ", { name: "Kids Bath Towel" }), false);
});