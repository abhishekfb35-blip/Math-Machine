import assert from "node:assert/strict";
import test from "node:test";
import { filterProductsByAttributeIds } from "../shared/attributeFilters";

const products = [
  { id: "couple", audience: ["aud-couples"], genders: ["gender-unisex"], themes: ["theme-couple"], styles: ["style-monogram"] },
  { id: "kids", audience: ["aud-kids"], genders: ["gender-female"], themes: ["theme-princess"], styles: ["style-cartoon"] },
  { id: "adult", audience: ["aud-adults"], genders: ["gender-male"], themes: ["theme-classic"], styles: ["style-monogram"] },
];

test("filters products by audience IDs", () => {
  assert.deepEqual(
    filterProductsByAttributeIds(products, { audienceId: "aud-couples" }).map(p => p.id),
    ["couple"],
  );
});

test("filters products by gender IDs", () => {
  assert.deepEqual(
    filterProductsByAttributeIds(products, { genderId: "gender-female" }).map(p => p.id),
    ["kids"],
  );
});

test("filters products by theme IDs", () => {
  assert.deepEqual(
    filterProductsByAttributeIds(products, { themeId: "theme-couple" }).map(p => p.id),
    ["couple"],
  );
});

test("filters products by style IDs", () => {
  assert.deepEqual(
    filterProductsByAttributeIds(products, { styleId: "style-monogram" }).map(p => p.id),
    ["couple", "adult"],
  );
});

test("combines dimensions with AND semantics", () => {
  assert.deepEqual(
    filterProductsByAttributeIds(products, {
      audienceId: "aud-couples",
      genderId: "gender-unisex",
      themeId: "theme-couple",
      styleId: "style-monogram",
    }).map(p => p.id),
    ["couple"],
  );
});