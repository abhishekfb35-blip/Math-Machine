import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ProductCreateRow } from "../shared/productCreateImport";

if (!process.env.TEST_DATABASE_URL) {
  describe("new product import persistence", () => {
    it("requires an isolated test database", { skip: "Set TEST_DATABASE_URL to run database integration tests" }, () => {});
  });
} else {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const [{ storage, ProductCreateImportValidationError }, { pool }] = await Promise.all([
    import("../server/storage"), import("../server/db"),
  ]);
  const prefix = "csv-product-create-test-";
  const categoryIds = [`${prefix}cat-a`, `${prefix}cat-b`];
  const username = `${prefix}admin`;
  const row = (suffix: string, overrides: Partial<ProductCreateRow> = {}): ProductCreateRow => ({
    sku: `${prefix}sku-${suffix}`, name: `CSV test ${suffix}`, slug: `${prefix}slug-${suffix}`,
    price: 999, categoryId: categoryIds[0], material: "100% cotton", gsm: 500, ...overrides,
  });
  const cleanup = async () => {
    const rows = await pool.query("SELECT id FROM products WHERE sku LIKE $1", [`${prefix}%`]);
    const ids = rows.rows.map(record => record.id);
    if (ids.length) {
      await pool.query("DELETE FROM product_images WHERE product_id = ANY($1::text[])", [ids]);
      await pool.query("DELETE FROM products WHERE id = ANY($1::text[])", [ids]);
    }
    await pool.query("DELETE FROM audit_logs WHERE action = 'import-new-products' AND username = $1", [username]);
    await pool.query("DELETE FROM categories WHERE id = ANY($1::text[])", [categoryIds]);
  };
  const findProducts = async () => (await pool.query("SELECT * FROM products WHERE sku LIKE $1 ORDER BY sku", [`${prefix}%`])).rows;

  before(async () => {
    await cleanup();
    for (const [index, id] of categoryIds.entries()) {
      await pool.query("INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)", [id, `CSV test ${index}`, id]);
    }
  });
  after(async () => { await cleanup(); await pool.end(); });

  describe("new product import persistence", () => {
    it("creates products in multiple categories with optional hero and bullet points", async () => {
      assert.deepEqual(await storage.importNewProducts([
        row("a", { bulletPoints: ['Soft, "fluffy" cotton', "Machine washable"], heroImageUrl: "/images/test.jpg" }),
        row("b", { categoryId: categoryIds[1], material: "Bamboo", gsm: 300, active: false }),
      ], username), { createdProducts: 2 });
      const products = await findProducts();
      assert.equal(products.length, 2);
      assert.equal(products[0].material, "100% cotton");
      assert.equal(products[0].gsm, 500);
      assert.deepEqual(JSON.parse(products[0].bullet_points), ['Soft, "fluffy" cotton', "Machine washable"]);
      assert.equal(products[1].category_id, categoryIds[1]);
      assert.equal(products[1].material, "Bamboo");
      assert.equal(products[1].gsm, 300);
      assert.equal(products[1].active, false);
      const hero = (await pool.query("SELECT image_url, sort_order, is_primary FROM product_images WHERE product_id = $1", [products[0].id])).rows;
      assert.deepEqual(hero.map(image => [image.image_url, image.sort_order, image.is_primary]), [["/images/test.jpg", 0, true]]);
    });

    it("rejects existing identity and unknown category without changing products", async () => {
      const beforeRows = await findProducts();
      await assert.rejects(storage.importNewProducts([
        row("new"), row("a"),
      ], username), ProductCreateImportValidationError);
      await assert.rejects(storage.importNewProducts([
        row("new"), row("bad-category", { categoryId: "unknown" }),
      ], username), ProductCreateImportValidationError);
      await assert.rejects(storage.importNewProducts([
        row("same"), row("same", { slug: `${prefix}different` }),
      ], username), ProductCreateImportValidationError);
      assert.deepEqual(await findProducts(), beforeRows);
    });

    it("rolls back earlier inserts if a later database write fails", async () => {
      const beforeRows = await findProducts();
      await assert.rejects(storage.importNewProducts([
        row("would-rollback"), row("invalid-db-int", { weightGrams: 2147483648 }),
      ], username));
      assert.deepEqual(await findProducts(), beforeRows);
    });

    it("does not create mixed-case duplicate identities from simultaneous CSV imports", async () => {
      const results = await Promise.allSettled([
        storage.importNewProducts([row("Concurrent")], username),
        storage.importNewProducts([row("concurrent")], username),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.filter(result => result.status === "rejected").length, 1);
      assert.equal((await findProducts()).filter(product =>
        product.sku.toLowerCase() === `${prefix}sku-concurrent`).length, 1);
    });
  });
}