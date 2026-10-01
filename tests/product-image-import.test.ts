import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe("product image import persistence", () => {
    it("requires an isolated test database", { skip: "set TEST_DATABASE_URL to run database integration tests" }, () => {});
  });
} else {
  process.env.DATABASE_URL = testDatabaseUrl;
  const [{ storage, ImageImportValidationError }, { pool }] = await Promise.all([
    import("../server/storage"),
    import("../server/db"),
  ]);
  const prefix = "image-csv-test-";
  const ids = [`${prefix}p1`, `${prefix}p2`];
  const cleanup = async () => {
    await pool.query("DELETE FROM audit_logs WHERE action IN ('import-product-images', 'import-image-urls') AND username = $1", [`${prefix}admin`]);
    await pool.query("DELETE FROM product_images WHERE product_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM products WHERE id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM categories WHERE id = $1", [`${prefix}category`]);
  };
  const images = async () => (await pool.query(
    "SELECT id, product_id, image_url, sort_order, is_primary FROM product_images WHERE product_id = ANY($1::text[]) ORDER BY product_id, sort_order",
    [ids],
  )).rows as Array<{ id: string; product_id: string; image_url: string; sort_order: number; is_primary: boolean }>;

  before(async () => {
    await cleanup();
    await pool.query("INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)", [`${prefix}category`, "CSV Test", `${prefix}category`]);
    for (let i = 0; i < ids.length; i++) {
      await pool.query("INSERT INTO products (id, sku, name, slug, price, category_id) VALUES ($1, $2, $3, $4, 100, $5)",
        [ids[i], `${prefix}sku${i}`, `CSV Test ${i}`, `${prefix}slug${i}`, `${prefix}category`]);
      await pool.query("INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary) VALUES ($1, $2, $3, 0, true)",
        [`${prefix}hero${i}`, ids[i], `/images/hero${i}.jpg`]);
    }
    await pool.query("INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary) VALUES ($1, $2, $3, 1, false)",
      [`${prefix}gallery`, ids[0], "/images/old.jpg"]);
  });
  after(async () => { await cleanup(); await pool.end(); });

  describe("product image import persistence", () => {
    it("rejects occupied positions and adds images only to empty positions without changing heroes", async () => {
      const beforeRows = await images();
      await assert.rejects(storage.importProductImageUrls([
        { productId: ids[0], imageUrl: "https://example.com/should-not-replace.jpg", imageSequenceNumber: 2 },
        { productId: ids[0], imageUrl: "/images/third.jpg", imageSequenceNumber: 3 },
      ], `${prefix}admin`), ImageImportValidationError);
      assert.deepEqual(await images(), beforeRows);

      const result = await storage.importProductImageUrls([
        { productId: ids[0], imageUrl: "/images/third.jpg", imageSequenceNumber: 3 },
        { productId: ids[1], imageUrl: "/images/other.jpg", imageSequenceNumber: 2 },
      ], `${prefix}admin`);
      assert.deepEqual(result, { addedRows: 2, addedProducts: 2 });
      const rows = await images();
      assert.equal(rows.length, 5);
      assert.equal(rows[0].id, `${prefix}hero0`);
      assert.equal(rows[0].image_url, "/images/hero0.jpg");
      assert.equal(rows[1].id, `${prefix}gallery`);
      assert.equal(rows[1].image_url, "/images/old.jpg");
      assert.equal(rows[2].image_url, "/images/third.jpg");
      assert.equal(rows[2].sort_order, 2);
      assert.equal(rows[3].id, `${prefix}hero1`);
      assert.equal(rows[4].is_primary, false);
    });

    it("rejects unknown products and duplicate targets without partial updates", async () => {
      const beforeRows = await images();
      await assert.rejects(storage.importProductImageUrls([
        { productId: ids[0], imageUrl: "/images/should-not-save.jpg", imageSequenceNumber: 2 },
        { productId: "unknown", imageUrl: "/images/unknown.jpg", imageSequenceNumber: 2 },
      ], `${prefix}admin`), ImageImportValidationError);
      await assert.rejects(storage.importProductImageUrls([
        { productId: ids[0], imageUrl: "/images/first.jpg", imageSequenceNumber: 2 },
        { productId: ids[0], imageUrl: "/images/second.jpg", imageSequenceNumber: 2 },
      ], `${prefix}admin`), ImageImportValidationError);
      assert.deepEqual(await images(), beforeRows);
    });

    it("rolls back earlier rows if a later gallery position is occupied ambiguously", async () => {
      await pool.query("INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary) VALUES ($1, $3, '/images/dup-a.jpg', 5, false), ($2, $3, '/images/dup-b.jpg', 5, false)",
        [`${prefix}dup-a`, `${prefix}dup-b`, ids[0]]);
      const beforeRows = await images();
      await assert.rejects(storage.importProductImageUrls([
        { productId: ids[0], imageUrl: "/images/rollback.jpg", imageSequenceNumber: 4 },
        { productId: ids[0], imageUrl: "/images/rejected.jpg", imageSequenceNumber: 6 },
      ], `${prefix}admin`), ImageImportValidationError);
      assert.deepEqual(await images(), beforeRows);
    });

    it("serializes overlapping imports and rejects the second insert into the same slot", async () => {
      const target = { productId: ids[1], imageSequenceNumber: 4 };
      const results = await Promise.allSettled([
        storage.importProductImageUrls([{ ...target, imageUrl: "/images/concurrent-a.jpg" }], `${prefix}admin`),
        storage.importProductImageUrls([{ ...target, imageUrl: "/images/concurrent-b.jpg" }], `${prefix}admin`),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.filter(result => result.status === "rejected").length, 1);
      const rows = (await images()).filter(row => row.product_id === ids[1] && row.sort_order === 3);
      assert.equal(rows.length, 1);
      assert.ok(["/images/concurrent-a.jpg", "/images/concurrent-b.jpg"].includes(rows[0].image_url));
    });
  });
}