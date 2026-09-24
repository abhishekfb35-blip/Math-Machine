import assert from "node:assert/strict";
import test from "node:test";
import {
  getProductSearchTerms,
  getProductSearchWordVariants,
  matchesProductSearch,
} from "../shared/productSearch";

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

test("recognizes singular and plural alternatives without changing SKU fragments", () => {
  assert.deepEqual(getProductSearchWordVariants("kid"), ["kids"]);
  assert.deepEqual(getProductSearchWordVariants("kids"), ["kid"]);
  assert.deepEqual(getProductSearchWordVariants("towels"), ["towel"]);
  assert.deepEqual(getProductSearchWordVariants("babies"), ["baby"]);
  assert.deepEqual(getProductSearchWordVariants("child"), ["children"]);
  assert.deepEqual(getProductSearchWordVariants("TL-001"), []);
});

test("matches singular and plural words in either direction across a multi-word query", () => {
  assert.equal(
    matchesProductSearch("kids towels", { name: "Personalized Kid's Bath Towel" }),
    true,
  );
  assert.equal(
    matchesProductSearch("kid towel", { name: "Personalized Kids Bath Towels" }),
    true,
  );
  assert.equal(
    matchesProductSearch("child dresses", { name: "Children's Party Dress" }),
    true,
  );
});

test("plural alternatives must be whole words and every query word must match", () => {
  assert.equal(matchesProductSearch("kids towel", { name: "Kidney Bath Towel" }), false);
  assert.equal(matchesProductSearch("kids towel", { name: "Kid Bath Robe" }), false);
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