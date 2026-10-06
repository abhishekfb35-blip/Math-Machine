import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaCatalogCsv,
  buildMetaCatalogRows,
  MetaCatalogExportError,
  META_CATALOG_CSV_HEADERS,
} from "../shared/metaCatalogCsv.ts";
import {
  getMetaCatalogGroupId,
  getMetaCatalogItemId,
} from "../shared/metaCatalogIds.ts";

const settings = {
  siteUrl: "https://shop.example.test/store/",
  brandName: "Example Brand",
};

const baseProduct = {
  id: "product-1",
  name: "Cotton towel",
  slug: "cotton-towel",
  description: "<p>Soft, \"fluffy\" cotton &amp; easy care</p>\nSecond line",
  price: 1200,
  imageUrl: "/images/towel.jpg",
  active: true,
};

test("builds grouped size/color rows with Pixel-compatible IDs, prices, and availability", () => {
  const rows = buildMetaCatalogRows([{
    product: baseProduct,
    sizes: [
      {
        name: "M",
        priceAdd: 100,
        blurOnFront: false,
        colors: [{ name: "Blue", blurOnFront: false }],
      },
      {
        name: "L",
        priceAdd: 150,
        blurOnFront: false,
        colors: [{ name: "Red", blurOnFront: false }],
      },
    ],
    variants: [
      { size: "M", color: "Blue", available: true },
      { size: "L", color: "Red", available: false },
    ],
  }], settings);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, getMetaCatalogItemId("product-1", "M", "Blue"));
  assert.equal(rows[1].id, getMetaCatalogItemId("product-1", "L", "Red"));
  assert.equal(rows[0].item_group_id, getMetaCatalogGroupId("product-1"));
  assert.equal(rows[1].item_group_id, getMetaCatalogGroupId("product-1"));
  assert.equal(rows[0].availability, "in stock");
  assert.equal(rows[1].availability, "out of stock");
  assert.equal(rows[0].price, "1300.00 INR");
  assert.equal(rows[1].price, "1350.00 INR");
  assert.equal(rows[0].condition, "new");
  assert.equal(rows[0].link, "https://shop.example.test/product/cotton-towel");
  assert.equal(rows[0].image_link, "https://shop.example.test/images/towel.jpg");
  assert.equal(rows[0].brand, "Example Brand");
  assert.equal(rows[0].description, 'Soft, "fluffy" cotton & easy care\n\nSecond line');
});

test("exports standalone products and omits inactive products", () => {
  const rows = buildMetaCatalogRows([
    { product: baseProduct },
    { product: { ...baseProduct, id: "inactive", active: false } },
  ], settings);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "product-1");
  assert.equal(rows[0].item_group_id, "");
  assert.equal(rows[0].price, "1200.00 INR");
});

test("keeps hidden configured variants grouped but marks them out of stock", () => {
  const rows = buildMetaCatalogRows([{
    product: baseProduct,
    sizes: [{
      name: "M",
      priceAdd: 0,
      blurOnFront: true,
      colors: [{ name: "Blue", blurOnFront: false }],
    }],
  }], settings);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, getMetaCatalogItemId("product-1", "M", "Blue"));
  assert.equal(rows[0].item_group_id, "product-1");
  assert.equal(rows[0].availability, "out of stock");
});

test("matches legacy audience-qualified variant sizes without changing unmatched availability", () => {
  const kidsColors = ["Turquoise Blue", "Baby Pink", "Lemon Yellow", "White", "Purple", "Orange"];
  const adultColors = ["Turquoise Blue", "Baby Pink", "White", "Gray", "Orange"];
  const source = {
    product: baseProduct,
    sizes: [
      {
        name: "120*60 cm",
        priceAdd: 0,
        blurOnFront: false,
        colors: kidsColors.map(name => ({ name, blurOnFront: false })),
      },
      {
        name: "150*75 cm",
        priceAdd: 0,
        blurOnFront: false,
        colors: adultColors.map(name => ({ name, blurOnFront: false })),
      },
    ],
    variants: kidsColors.map(color => ({
      size: "120*60 cm, Kids Size",
      color: color === "Purple" ? "Purple " : color,
      available: true,
    })),
  };
  const rows = buildMetaCatalogRows([source], settings);
  const csv = buildMetaCatalogCsv([source], settings);
  const csvRows = csv.trimEnd().split("\r\n").slice(1);

  assert.equal(rows.length, 11);
  assert.equal(rows.filter(row => row.availability === "in stock").length, 6);
  assert.equal(rows.filter(row => row.availability === "out of stock").length, 5);
  assert.equal(new Set(rows.map(row => row.id)).size, 11);
  assert.ok(rows.every(row => row.item_group_id === getMetaCatalogGroupId(baseProduct.id)));
  assert.equal(csvRows.length, 11);
  assert.equal(csvRows.filter(row => /,in stock,new,/.test(row)).length, 6);
  assert.equal(csvRows.filter(row => /,out of stock,new,/.test(row)).length, 5);
});

test("keeps an explicitly unavailable legacy-qualified variant out of stock", () => {
  const rows = buildMetaCatalogRows([{
    product: baseProduct,
    sizes: [{
      name: "120*60 cm",
      priceAdd: 0,
      blurOnFront: false,
      colors: [{ name: "Blue", blurOnFront: false }],
    }],
    variants: [
      { size: "120*60 cm, Kids Size", color: "Blue", available: false },
    ],
  }], settings);

  assert.equal(rows[0].availability, "out of stock");
});

test("rejects ambiguous legacy size matches but prefers an exact size match", () => {
  const ambiguousSource = {
    product: baseProduct,
    sizes: [{
      name: "120*60 cm",
      priceAdd: 0,
      blurOnFront: false,
      colors: [{ name: "Blue", blurOnFront: false }],
    }],
    variants: [
      { size: "120*60 cm, Kids Size", color: "Blue", available: true },
      { size: "120*60 cm, Adult Size", color: "Blue", available: true },
    ],
  };

  assert.throws(
    () => buildMetaCatalogRows([ambiguousSource], settings),
    /matches multiple legacy size labels/,
  );

  const exactMatchRows = buildMetaCatalogRows([{
    ...ambiguousSource,
    variants: [
      { size: "120*60 cm", color: "Blue", available: false },
      { size: "120*60 cm, Kids Size", color: "Blue", available: true },
    ],
  }], settings);
  assert.equal(exactMatchRows[0].availability, "out of stock");
});

test("CSV includes Meta columns and correctly escapes quotes, commas, and newlines", () => {
  const csv = buildMetaCatalogCsv([{ product: baseProduct }], settings);
  const [header, ...lines] = csv.trimEnd().split("\r\n");
  assert.equal(header, META_CATALOG_CSV_HEADERS.join(","));
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('"Soft, ""fluffy"" cotton & easy care\n\nSecond line"'));
  assert.ok(lines[0].includes("https://shop.example.test/images/towel.jpg"));
});

test("requires an image for every active product and enforces unique item IDs", () => {
  assert.throws(
    () => buildMetaCatalogRows([{ product: { ...baseProduct, imageUrl: "" } }], settings),
    MetaCatalogExportError,
  );

  const variantId = getMetaCatalogItemId("product-1", "M", "Blue");
  assert.throws(() => buildMetaCatalogRows([
    {
      product: baseProduct,
      sizes: [{
        name: "M",
        priceAdd: 0,
        blurOnFront: false,
        colors: [{ name: "Blue", blurOnFront: false }],
      }],
    },
    { product: { ...baseProduct, id: variantId, slug: "conflicting-item" } },
  ], settings), /not unique/);
});