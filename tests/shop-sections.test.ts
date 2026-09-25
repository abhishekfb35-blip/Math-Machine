import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupProductsByShopSections,
  normalizeShopSections,
  productsForShopSection,
  type ShopSection,
} from "../shared/shopSections";
import type { Category, Product } from "../shared/types";

const categories = [
  { id: "towels", name: "Bath Towels", slug: "bath-towels" },
  { id: "robes", name: "Bathrobes", slug: "bathrobes" },
] as Category[];

function makeProduct(
  id: string,
  values: Partial<Product> = {},
): Product {
  return {
    id,
    categoryId: "towels",
    audience: [],
    genders: [],
    themes: [],
    styles: [],
    tagNames: [],
    ...values,
  } as Product;
}

function makeSection(values: Partial<ShopSection> & Pick<ShopSection, "label">): ShopSection {
  return {
    tag: values.label.toLowerCase().replace(/\s+/g, "-"),
    maxShown: 1,
    enabled: true,
    ...values,
  };
}

test("section matching applies every configured filter and does not truncate by maxShown", () => {
  const section = makeSection({
    label: "Personalised Towels",
    categories: ["bath-towels"],
    audience: ["kids", "adults"],
    genders: ["female"],
    themes: ["holiday"],
    styles: ["embroidered"],
    tags: ["Cotton"],
  });
  const matches = [
    makeProduct("kid-match", {
      audience: ["kids"],
      genders: ["female"],
      themes: ["holiday"],
      styles: ["embroidered"],
      tagNames: ["cotton"],
    }),
    makeProduct("adult-match", {
      audience: ["adults"],
      genders: ["female"],
      themes: ["holiday"],
      styles: ["embroidered"],
      tagNames: ["COTTON"],
    }),
    makeProduct("wrong-category", {
      categoryId: "robes",
      audience: ["kids"],
      genders: ["female"],
      themes: ["holiday"],
      styles: ["embroidered"],
      tagNames: ["cotton"],
    }),
    makeProduct("wrong-style", {
      audience: ["kids"],
      genders: ["female"],
      themes: ["holiday"],
      styles: ["printed"],
      tagNames: ["cotton"],
    }),
  ];

  assert.deepEqual(
    productsForShopSection(matches, categories, section).map(product => product.id),
    ["kid-match", "adult-match"],
  );
});

test("grouping preserves overlaps and only falls back products unmatched by any section", () => {
  const products = [
    makeProduct("shared", { audience: ["kids", "couples"] }),
    makeProduct("kids-only", { audience: ["kids"] }),
    makeProduct("disabled-only", { audience: ["hidden"] }),
    makeProduct("unassigned"),
  ];
  const sections = [
    makeSection({ label: "Kids Towels", audience: ["kids"] }),
    makeSection({ label: "Couple Towels", audience: ["couples"] }),
    makeSection({ label: "Hidden Section", audience: ["hidden"], enabled: false }),
  ];

  const groups = groupProductsByShopSections(products, categories, sections);
  assert.deepEqual(groups.map(group => group.label), ["Kids Towels", "Couple Towels", "Other Products"]);
  assert.deepEqual(groups[0].all.map(product => product.id), ["shared", "kids-only"]);
  assert.deepEqual(groups[1].all.map(product => product.id), ["shared"]);
  assert.deepEqual(groups[2].all.map(product => product.id), ["unassigned"]);

  const uniqueAssignedIds = new Set(groups.flatMap(group => group.all.map(product => product.id)));
  assert.deepEqual(uniqueAssignedIds, new Set(["shared", "kids-only", "unassigned"]));
  assert.equal(uniqueAssignedIds.has("disabled-only"), false);
});

test("normalization keeps section keys separate from product tags", () => {
  const sections = normalizeShopSections([{
    label: "Kids Towels",
    tag: "kids-towels",
    tags: ["Children's Cotton"],
    enabled: true,
    maxShown: 1,
  }]);

  assert.equal(sections[0].tag, "kids-towels");
  assert.deepEqual(sections[0].tags, ["Children's Cotton"]);
  assert.equal(sections[0].maxShown, 1);
});