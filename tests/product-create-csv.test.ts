import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProductCreateCsv } from "../client/src/lib/productCreateCsv";
import { productCreateColumns, productCreateImportSchema, duplicateProductCreateRows } from "../shared/productCreateImport";

const header = "sku,name,slug,price,category_id,bullet_points,material,gsm";
const known = new Set(["cat-one", "cat-two"]);

describe("new product CSV", () => {
  it("accepts quoted multiline bullets with commas and quotes and applies defaults", () => {
    const result = parseProductCreateCsv(`${header}\r\nS-1,Towel,towel,999,cat-one,"Soft, ""fluffy"" cotton\r\n\r\nMachine washable",,`,
      known, []);
    assert.equal(result.error, undefined);
    assert.equal(result.rows[0].errors.length, 0);
    assert.deepEqual(result.rows[0].product?.bulletPoints, ['Soft, "fluffy" cotton', "Machine washable"]);
    assert.equal(result.rows[0].product?.material, "100% cotton");
    assert.equal(result.rows[0].product?.gsm, 500);
    assert.equal(result.rows[0].line, 2);
    assert.equal(productCreateImportSchema.safeParse({ rows: [result.rows[0].product] }).success, true);
  });

  it("accepts a minimal required-header file and explicit default overrides", () => {
    const minimal = parseProductCreateCsv("sku,name,slug,price,category_id\nS-2,Towel 2,towel-2,1200,cat-two", known, []);
    assert.equal(minimal.rows[0].product?.material, "100% cotton");
    assert.equal(minimal.rows[0].product?.gsm, 500);
    const override = parseProductCreateCsv(`${header}\nS-3,Towel 3,towel-3,100,cat-one,,Bamboo,300`, known, []);
    assert.equal(override.rows[0].product?.material, "Bamboo");
    assert.equal(override.rows[0].product?.gsm, 300);
  });

  it("rejects unknown or duplicate headers including excluded fields", () => {
    assert.ok(!productCreateColumns.includes("amazon_asin" as never));
    assert.ok(!productCreateColumns.includes("wholesale_price" as never));
    for (const field of ["amazon_asin", "wholesale_price", "sku"]) {
      const result = parseProductCreateCsv(`sku,name,slug,price,category_id,${field}\nS-1,Towel,towel,999,cat-one,other`);
      assert.match(result.error!, /Headers must include/);
    }
    assert.match(parseProductCreateCsv("sku,name,slug,price\nS-1,Towel,towel,999").error!, /Headers must include/);
    assert.match(parseProductCreateCsv(`${header}\nS-1,\"unclosed,towel,999,cat-one`).error!, /Unclosed quote/);
  });

  it("rejects invalid values, unknown categories, duplicate and existing SKU/slugs", () => {
    const result = parseProductCreateCsv(
      "sku,name,slug,price,category_id,hero_image_url,active,gsm\n" +
      "OLD,Towel,old-slug,0,missing,javascript:alert(1),maybe,abc\n" +
      "S-2,Towel,same,999,cat-one,/images/a.jpg,true,500\n" +
      "s-2,Towel,same,999,cat-two,/images/b.jpg,false,500",
      known, [{ sku: "old", slug: "old-slug" }]);
    assert.match(result.rows[0].errors.join("; "), /Already exists/);
    assert.match(result.rows[0].errors.join("; "), /Category not found/);
    assert.match(result.rows[0].errors.join("; "), /hero_image_url|active|gsm|price/);
    assert.match(result.rows[1].errors.join("; "), /Duplicate SKU|Duplicate SLUG/);
    assert.match(result.rows[2].errors.join("; "), /Duplicate SKU|Duplicate SLUG/);
    assert.equal(duplicateProductCreateRows([{ sku: "X", slug: "a" }, { sku: "x", slug: "b" }]).length, 2);
    assert.equal(productCreateImportSchema.safeParse({ rows: [{
      sku: "X", name: "A", slug: "a", price: 1, categoryId: "cat-one", amazonAsin: "B123",
    }] }).success, false);
  });

  it("reports physical line after a multiline cell and malformed row widths", () => {
    const result = parseProductCreateCsv(
      "sku,name,slug,price,category_id,bullet_points\nS-1,Towel,first,999,cat-one,\"one\ntwo\"\nS-2,Towel,second,999,missing,",
      known, []);
    assert.equal(result.rows[1].line, 4);
    assert.match(result.rows[1].errors.join("; "), /Category not found/);
    assert.match(parseProductCreateCsv("sku,name,slug,price,category_id\nS-1,Towel,slug,1,cat-one,extra").rows[0].errors.join("; "), /Expected 5 columns/);
  });
});