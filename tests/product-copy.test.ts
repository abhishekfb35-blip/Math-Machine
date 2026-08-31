import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe("product copy", () => {
    it("requires TEST_DATABASE_URL", { skip: "set TEST_DATABASE_URL to run the database integration test" }, () => {});
  });
} else {
  process.env.DATABASE_URL = testDatabaseUrl;

  const [{ storage }, { pool }] = await Promise.all([
    import("../server/storage"),
    import("../server/db"),
  ]);

  const prefix = "product-copy-test-";
  const sourceId = `${prefix}source`;
  const categoryId = `${prefix}category`;
  const tagTypeId = `${prefix}tag-type`;
  const tagId = `${prefix}tag`;
  const audienceId = `${prefix}audience`;
  const genderId = `${prefix}gender`;
  const themeId = `${prefix}theme`;
  const styleId = `${prefix}style`;

  async function cleanup(): Promise<void> {
    const productIds = (await pool.query(
      "SELECT id FROM products WHERE id = $1 OR slug LIKE $2",
      [sourceId, `${prefix}%`],
    )).rows.map(row => row.id);

    if (productIds.length > 0) {
      for (const table of [
        "product_reviews",
        "product_variants",
        "product_styles",
        "product_themes",
        "product_genders",
        "product_audience",
        "product_tags",
        "product_images",
        "cart_items",
        "wishlists",
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE product_id = ANY($1::text[])`, [productIds]);
      }
      await pool.query("DELETE FROM products WHERE id = ANY($1::text[])", [productIds]);
    }

    await pool.query("DELETE FROM tags WHERE id = $1", [tagId]);
    await pool.query("DELETE FROM tag_types WHERE id = $1", [tagTypeId]);
    await pool.query("DELETE FROM audience WHERE id = $1", [audienceId]);
    await pool.query("DELETE FROM genders WHERE id = $1", [genderId]);
    await pool.query("DELETE FROM themes WHERE id = $1", [themeId]);
    await pool.query("DELETE FROM styles WHERE id = $1", [styleId]);
    await pool.query("DELETE FROM categories WHERE id = $1", [categoryId]);
  }

  before(async () => {
    await cleanup();
    await pool.query(
      "INSERT INTO categories (id, name, slug, sort_order) VALUES ($1, $2, $3, $4)",
      [categoryId, "Copy Test Category", `${prefix}category`, 1],
    );
    await pool.query(
      `INSERT INTO products
        (id, sku, name, slug, description, price, mrp, category_id, amazon_asin, color, material, gsm,
         dimensions, weight_grams, items_in_set, special_features, bullet_points, search_keywords,
         product_type, active, sort_order, variant_colors, variant_sizes, wholesale_price)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        sourceId, `${prefix}sku`, "Copy Test Product", `${prefix}product`, "Copy description", 1299, 1599,
        categoryId, "COPYASIN", "Blue", "Cotton", 500, "120 x 60 cm", 400, 2,
        '["Soft"]', '["Pure cotton"]', '["copy test"]', "towel", true, 7,
        '[{"name":"Blue"}]', '[{"name":"Large"}]', 999,
      ],
    );
    await pool.query(
      "INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary) VALUES ($1, $2, $3, $4, $5), ($6, $2, $7, $8, $9)",
      [`${prefix}image-1`, sourceId, "/images/copy-1.jpg", 0, true, `${prefix}image-2`, "/images/copy-2.jpg", 1, false],
    );
    await pool.query("INSERT INTO tag_types (id, name, slug, sort_order) VALUES ($1, $2, $3, $4)", [tagTypeId, `${prefix}Tag Type`, `${prefix}tag-type`, 1]);
    await pool.query("INSERT INTO tags (id, name, tag_type_id, sort_order) VALUES ($1, $2, $3, $4)", [tagId, `${prefix}tag`, tagTypeId, 1]);
    await pool.query("INSERT INTO product_tags (id, product_id, tag_id) VALUES ($1, $2, $3)", [`${prefix}product-tag`, sourceId, tagId]);
    await pool.query("INSERT INTO audience (id, name, sort_order) VALUES ($1, $2, $3)", [audienceId, `${prefix}audience`, 1]);
    await pool.query("INSERT INTO genders (id, name, sort_order) VALUES ($1, $2, $3)", [genderId, `${prefix}gender`, 1]);
    await pool.query("INSERT INTO themes (id, name, sort_order) VALUES ($1, $2, $3)", [themeId, `${prefix}theme`, 1]);
    await pool.query("INSERT INTO styles (id, name, sort_order) VALUES ($1, $2, $3)", [styleId, `${prefix}style`, 1]);
    await pool.query("INSERT INTO product_audience (id, product_id, audience_id) VALUES ($1, $2, $3)", [`${prefix}product-audience`, sourceId, audienceId]);
    await pool.query("INSERT INTO product_genders (id, product_id, gender_id) VALUES ($1, $2, $3)", [`${prefix}product-gender`, sourceId, genderId]);
    await pool.query("INSERT INTO product_themes (id, product_id, theme_id) VALUES ($1, $2, $3)", [`${prefix}product-theme`, sourceId, themeId]);
    await pool.query("INSERT INTO product_styles (id, product_id, style_id) VALUES ($1, $2, $3)", [`${prefix}product-style`, sourceId, styleId]);
    await pool.query(
      "INSERT INTO product_variants (id, product_id, color, size, available) VALUES ($1, $2, $3, $4, $5)",
      [`${prefix}variant`, sourceId, "Blue", "Large", true],
    );
    await pool.query(
      "INSERT INTO product_reviews (id, product_id, reviewer_name, rating, body) VALUES ($1, $2, $3, $4, $5)",
      [`${prefix}review`, sourceId, "Source Reviewer", 5, "Source-only review"],
    );
    await pool.query(
      "INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES ($1, $2, $3, $4)",
      [`${prefix}cart-item`, `${prefix}cart`, sourceId, 1],
    );
    await pool.query(
      "INSERT INTO wishlists (id, customer_id, product_id) VALUES ($1, $2, $3)",
      [`${prefix}wishlist`, `${prefix}customer`, sourceId],
    );
  });

  after(async () => {
    await cleanup();
    await pool.end();
  });

  describe("product copy", () => {
    it("copies catalog data with fresh identity and excludes history", async () => {
      const copied = await storage.copyProduct(sourceId);
      assert.ok(copied);
      assert.notEqual(copied.id, sourceId);
      assert.notEqual(copied.sku, `${prefix}sku`);
      assert.equal(copied.name, "Copy Test Product (Copy)");
      assert.equal(copied.slug, `${prefix}product-copy`);
      assert.equal(copied.description, "Copy description");
      assert.equal(copied.price, 1299);
      assert.equal(copied.categoryId, categoryId);
      assert.deepEqual(copied.audience, [audienceId]);
      assert.deepEqual(copied.genders, [genderId]);
      assert.deepEqual(copied.themes, [themeId]);
      assert.deepEqual(copied.styles, [styleId]);

      const [images, tags, variants, reviews, cartItems, wishlists, source] = await Promise.all([
        pool.query("SELECT image_url, sort_order, is_primary FROM product_images WHERE product_id = $1 ORDER BY sort_order", [copied.id]),
        pool.query("SELECT tag_id FROM product_tags WHERE product_id = $1", [copied.id]),
        pool.query("SELECT color, size, available FROM product_variants WHERE product_id = $1", [copied.id]),
        pool.query("SELECT id FROM product_reviews WHERE product_id = $1", [copied.id]),
        pool.query("SELECT id FROM cart_items WHERE product_id = $1", [copied.id]),
        pool.query("SELECT id FROM wishlists WHERE product_id = $1", [copied.id]),
        pool.query("SELECT name, slug, sku FROM products WHERE id = $1", [sourceId]),
      ]);

      assert.deepEqual(images.rows, [
        { image_url: "/images/copy-1.jpg", sort_order: 0, is_primary: true },
        { image_url: "/images/copy-2.jpg", sort_order: 1, is_primary: false },
      ]);
      assert.deepEqual(tags.rows, [{ tag_id: tagId }]);
      assert.deepEqual(variants.rows, [{ color: "Blue", size: "Large", available: true }]);
      assert.equal(reviews.rowCount, 0);
      assert.equal(cartItems.rowCount, 0);
      assert.equal(wishlists.rowCount, 0);
      assert.deepEqual(source.rows, [{
        name: "Copy Test Product",
        slug: `${prefix}product`,
        sku: `${prefix}sku`,
      }]);

      const secondCopy = await storage.copyProduct(sourceId);
      assert.ok(secondCopy);
      assert.equal(secondCopy.slug, `${prefix}product-copy-2`);
    });

    it("creates a staged draft only when the explicit save operation is called", async () => {
      const saved = await storage.createProductFromDraft(
        {
          name: "Saved Draft Product",
          slug: `${prefix}saved-draft`,
          description: "Draft description",
          price: 1499,
          mrp: 1799,
          categoryId,
          active: false,
        },
        {
          tagIds: [tagId],
          audienceIds: [audienceId],
          genderIds: [genderId],
          themeIds: [themeId],
          styleIds: [styleId],
          images: [
            { imageUrl: "/images/draft-1.jpg", sortOrder: 0, isPrimary: true },
            { imageUrl: "/images/draft-2.jpg", sortOrder: 1, isPrimary: false },
          ],
          variants: [{ color: "Blue", size: "Large", available: false }],
        },
      );

      assert.notEqual(saved.id, sourceId);
      assert.equal(saved.name, "Saved Draft Product");
      assert.equal(saved.sku?.startsWith("TL"), true);

      const [images, tags, attributes, variants] = await Promise.all([
        pool.query("SELECT image_url, sort_order, is_primary FROM product_images WHERE product_id = $1 ORDER BY sort_order", [saved.id]),
        pool.query("SELECT tag_id FROM product_tags WHERE product_id = $1", [saved.id]),
        pool.query(
          `SELECT
             (SELECT count(*) FROM product_audience WHERE product_id = $1) AS audience_count,
             (SELECT count(*) FROM product_genders WHERE product_id = $1) AS gender_count,
             (SELECT count(*) FROM product_themes WHERE product_id = $1) AS theme_count,
             (SELECT count(*) FROM product_styles WHERE product_id = $1) AS style_count`,
          [saved.id],
        ),
        pool.query("SELECT color, size, available FROM product_variants WHERE product_id = $1", [saved.id]),
      ]);

      assert.deepEqual(images.rows, [
        { image_url: "/images/draft-1.jpg", sort_order: 0, is_primary: true },
        { image_url: "/images/draft-2.jpg", sort_order: 1, is_primary: false },
      ]);
      assert.deepEqual(tags.rows, [{ tag_id: tagId }]);
      assert.deepEqual(attributes.rows, [{ audience_count: "1", gender_count: "1", theme_count: "1", style_count: "1" }]);
      assert.deepEqual(variants.rows, [{ color: "Blue", size: "Large", available: false }]);
    });
  });
}