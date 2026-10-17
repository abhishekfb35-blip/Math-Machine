import assert from "node:assert/strict";
import test from "node:test";
import { hasProductFilters, productMatchesFilters } from "../shared/productFilters.ts";
import type { Category, Product } from "../shared/types.ts";

const categories: Category[] = [
  { id: "cat-towels", name: "Towels", slug: "towels", description: null, imageUrl: null, sortOrder: 0 },
  { id: "cat-blankets", name: "Blankets", slug: "blankets", description: null, imageUrl: null, sortOrder: 1 },
];

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p-1",
  sku: null,
  name: "Princess Towel",
  slug: "princess-towel",
  description: null,
  price: 1000,
  mrp: null,
  wholesalePrice: null,
  imageUrl: "/princess-towel.jpg",
  categoryId: "cat-towels",
  amazonAsin: null,
  color: null,
  material: null,
  gsm: null,
  dimensions: null,
  weightGrams: null,
  itemsInSet: null,
  specialFeatures: null,
  bulletPoints: null,
  searchKeywords: null,
  productType: null,
  audience: ["kids"],
  genders: ["girls"],
  themes: ["princess"],
  styles: ["embroidered"],
  audienceNames: ["Kids"],
  genderNames: ["Girls"],
  themeNames: ["Princess"],
  styleNames: ["Embroidered"],
  active: true,
  sortOrder: 0,
  createdAt: null,
  updatedAt: null,
  tagNames: ["Birthday Gift"],
  ...overrides,
});

test("collection-card filters combine categories and attributes, with OR within each filter", () => {
  const item = product();
  assert.equal(productMatchesFilters(item, categories, {
    categoryFilters: ["towels"],
    audienceFilters: ["adults", "kids"],
    themeFilters: ["unicorn", "princess"],
  }), true);
  assert.equal(productMatchesFilters(item, categories, { categoryFilters: ["blankets"] }), false);
  assert.equal(productMatchesFilters(item, categories, { audienceFilters: ["adults"] }), false);
});

test("collection-card filters match tags case-insensitively and exclude inactive products", () => {
  assert.equal(productMatchesFilters(product(), categories, { tagFilters: ["birthday gift"] }), true);
  assert.equal(productMatchesFilters(product({ active: false }), categories, { themeFilters: ["princess"] }), false);
});

test("empty filters are recognized as unconfigured", () => {
  assert.equal(hasProductFilters({}), false);
  assert.equal(hasProductFilters({ themeFilters: ["princess"] }), true);
});
