import assert from "node:assert/strict";
import { describe, it } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe("catalog snapshot sync boundary", () => {
    it("requires TEST_DATABASE_URL", { skip: "set TEST_DATABASE_URL to run the database integration test" }, () => {});
  });
} else {
  // server/db.ts reads DATABASE_URL during module initialization. Keep this test
  // pointed at an explicitly supplied database instead of a developer's default.
  process.env.DATABASE_URL = testDatabaseUrl;

  const [{ seedDatabase }, { pool }] = await Promise.all([
    import("../server/seed"),
    import("../server/db"),
  ]);

  const prefix = "catalog-sync-boundary-";

  const initialSnapshot = {
    tagTypes: [
      { id: `${prefix}tag-type`, name: "Merchandising", slug: `${prefix}merchandising`, description: "Initial signals", sortOrder: 1 },
    ],
    categories: [
      { id: `${prefix}category`, name: "Initial Towels", slug: `${prefix}towels`, description: "Initial catalog", imageUrl: null, sortOrder: 1 },
    ],
    tags: [
      { id: `${prefix}tag`, name: "initial_tag", description: "Initial tag", tagTypeId: `${prefix}tag-type`, sortOrder: 1 },
    ],
    products: [
      {
        id: `${prefix}old-product`,
        sku: `${prefix}old-sku`,
        name: "Initial Towel",
        slug: `${prefix}old-product`,
        description: "Initial catalog product",
        price: 1200,
        mrp: 1500,
        categorySlug: `${prefix}towels`,
        active: true,
        sortOrder: 1,
        productType: "towel",
        variantColors: "[]",
        variantSizes: "[]",
      },
    ],
    productTags: [
      { id: `${prefix}product-tag`, productSlug: `${prefix}old-product`, tagName: "initial_tag" },
    ],
    siteContent: [{ key: "hero", value: "Initial hero copy" }],
  };

  const incomingSnapshot = {
    tagTypes: initialSnapshot.tagTypes,
    categories: [
      { ...initialSnapshot.categories[0], name: "Updated Towels", description: "Updated catalog" },
    ],
    tags: [
      { ...initialSnapshot.tags[0], id: `${prefix}new-tag`, name: "updated_tag", description: "Updated tag" },
    ],
    products: [
      {
        ...initialSnapshot.products[0],
        id: `${prefix}new-product`,
        sku: `${prefix}new-sku`,
        name: "Updated Towel",
        slug: `${prefix}new-product`,
        price: 1800,
        mrp: 2200,
      },
    ],
    productTags: [
      { id: `${prefix}new-product-tag`, productSlug: `${prefix}new-product`, tagName: "updated_tag" },
    ],
    siteContent: [{ key: "hero", value: "Updated hero copy" }],
  };

  const invalidIncomingSnapshot = {
    ...incomingSnapshot,
    // This fails after the catalog and shared-content sync steps have run,
    // making sure the transaction covers the whole replacement.
    categorySizeDefinitions: [{
      id: `${prefix}invalid-size-definition`,
      categorySlug: `${prefix}missing-category`,
      name: "Invalid size definition",
    }],
  };

  const transactionalQueries: Record<string, string> = {
    customers: `SELECT * FROM customers WHERE id LIKE '${prefix}%' ORDER BY id`,
    customer_consents: `SELECT * FROM customer_consents WHERE id LIKE '${prefix}%' ORDER BY id`,
    customer_sessions: `SELECT * FROM customer_sessions WHERE id LIKE '${prefix}%' ORDER BY id`,
    carts: `SELECT * FROM carts WHERE id LIKE '${prefix}%' ORDER BY id`,
    cart_items: `SELECT * FROM cart_items WHERE id LIKE '${prefix}%' ORDER BY id`,
    orders: `SELECT * FROM orders WHERE id LIKE '${prefix}%' ORDER BY id`,
    order_items: `SELECT * FROM order_items WHERE id LIKE '${prefix}%' ORDER BY id`,
    payment_attempts: `SELECT * FROM payment_attempts WHERE id LIKE '${prefix}%' ORDER BY id`,
    wishlists: `SELECT * FROM wishlists WHERE id LIKE '${prefix}%' ORDER BY id`,
  };

  async function readTransactionalRows(): Promise<Record<string, unknown[]>> {
    const entries = await Promise.all(
      Object.entries(transactionalQueries).map(async ([table, query]) => [
        table,
        (await pool.query(query)).rows,
      ] as const),
    );
    return Object.fromEntries(entries);
  }

  async function readCatalogAndSharedContent(): Promise<Record<string, unknown[]>> {
    const queries: Record<string, string> = {
      categories: "SELECT * FROM categories ORDER BY id",
      products: "SELECT * FROM products ORDER BY id",
      tagTypes: "SELECT * FROM tag_types ORDER BY id",
      tags: "SELECT * FROM tags ORDER BY id",
      productTags: "SELECT * FROM product_tags ORDER BY id",
      siteContent: "SELECT * FROM site_content ORDER BY key",
    };
    const entries = await Promise.all(
      Object.entries(queries).map(async ([table, query]) => [
        table,
        (await pool.query(query)).rows,
      ] as const),
    );
    return Object.fromEntries(entries);
  }

  async function cleanupTransactionalRows(): Promise<void> {
    // payment_attempts is the only representative row with database-level
    // references, so remove children before their cart/order parents.
    for (const table of [
      "payment_attempts",
      "order_items",
      "cart_items",
      "wishlists",
      "customer_consents",
      "customer_sessions",
      "orders",
      "carts",
      "customers",
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE id LIKE $1`, [`${prefix}%`]);
    }
  }

  async function seedTransactionalRows(): Promise<void> {
    const timestamp = "2026-08-30T12:00:00.000Z";

    await pool.query(
      `INSERT INTO customers
        (id, email, name, phone, shipping_address, shipping_city, shipping_state, shipping_pincode, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [`${prefix}customer`, `${prefix}customer@example.com`, "Catalog Boundary Customer", "+919876543210", "1 Test Street", "Pune", "Maharashtra", "411001", timestamp],
    );
    await pool.query(
      `INSERT INTO customer_consents
        (id, customer_id, first_name, last_name, email, phone, consent_type, consent_given, discount_code, discount_used, ip_address, user_agent, page_url, consent_method, consent_text, consented_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [`${prefix}consent`, `${prefix}customer`, "Catalog", "Boundary", `${prefix}customer@example.com`, "+919876543210", "marketing", true, `${prefix}discount`, false, "192.0.2.10", "integration-test", "/checkout", "checkbox", "I agree", timestamp],
    );
    await pool.query(
      `INSERT INTO customer_sessions (id, customer_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [`${prefix}session`, `${prefix}customer`, `${prefix}session-token`, "2026-09-30T12:00:00.000Z", timestamp],
    );
    await pool.query(
      `INSERT INTO carts
        (id, session_id, customer_id, updated_at, abandoned_email_sent_at, checkout_started_at, checkout_email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [`${prefix}cart`, `${prefix}cart-session`, `${prefix}customer`, timestamp, "2026-08-30T12:05:00.000Z", "2026-08-30T12:10:00.000Z", `${prefix}customer@example.com`, timestamp],
    );
    await pool.query(
      `INSERT INTO cart_items
        (id, cart_id, product_id, quantity, personalization_name, selected_color, selected_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [`${prefix}cart-item`, `${prefix}cart`, `${prefix}old-product`, 2, "Boundary", "Blue", "Large"],
    );
    await pool.query(
      `INSERT INTO orders
        (id, customer_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, subtotal, discount, shipping_fee, total, status, payment_id, razorpay_order_id, payment_status, currency, notes, email_status, courier_partner, service_type, tracking_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24)`,
      [`${prefix}order`, `${prefix}customer`, "Catalog Boundary Customer", `${prefix}customer@example.com`, "+919876543210", "1 Test Street", "Pune", "Maharashtra", "411001", 2400, 100, 50, 2350, "paid", `${prefix}payment`, `${prefix}razorpay`, "captured", "INR", "Do not change", JSON.stringify({ sent: false, attempts: 2 }), "Test Courier", "standard", `${prefix}tracking`, timestamp],
    );
    await pool.query(
      `INSERT INTO order_items
        (id, order_id, product_id, product_name, product_price, quantity, personalization_name, selected_color, selected_size, is_free)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`${prefix}order-item`, `${prefix}order`, `${prefix}old-product`, "Initial Towel", 1200, 2, "Boundary", "Blue", "Large", false],
    );
    await pool.query(
      `INSERT INTO payment_attempts
        (id, cart_id, order_id, razorpay_order_id, attempt_at, status, failure_reason, failure_code, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [`${prefix}payment-attempt`, `${prefix}cart`, `${prefix}order`, `${prefix}razorpay-attempt`, timestamp, "success", null, null, 2350],
    );
    await pool.query(
      `INSERT INTO wishlists (id, customer_id, product_id, created_at)
       VALUES ($1, $2, $3, $4)`,
      [`${prefix}wishlist`, `${prefix}customer`, `${prefix}old-product`, timestamp],
    );
  }

  async function assertIncomingCatalog(): Promise<void> {
    const [categories, products, tagTypes, tags, productTags, siteContent] = await Promise.all([
      pool.query(`SELECT id, name, slug, description, image_url, sort_order FROM categories ORDER BY id`),
      pool.query(`SELECT id, sku, name, slug, description, price, mrp, category_id, amazon_asin, color, material, gsm, dimensions, weight_grams, items_in_set, special_features, bullet_points, search_keywords, product_type, active, sort_order, variant_colors, variant_sizes, wholesale_price FROM products ORDER BY id`),
      pool.query(`SELECT id, name, slug, description, sort_order FROM tag_types ORDER BY id`),
      pool.query(`SELECT id, name, description, tag_type_id, sort_order FROM tags ORDER BY id`),
      pool.query(`SELECT pt.id, pt.product_id, pt.tag_id FROM product_tags pt ORDER BY pt.id`),
      pool.query(`SELECT key, value FROM site_content ORDER BY key`),
    ]);

    assert.deepEqual(categories.rows, [
      { id: `${prefix}category`, name: "Updated Towels", slug: `${prefix}towels`, description: "Updated catalog", image_url: null, sort_order: 1 },
    ]);
    assert.deepEqual(products.rows, [{
      id: `${prefix}new-product`,
      sku: `${prefix}new-sku`,
      name: "Updated Towel",
      slug: `${prefix}new-product`,
      description: "Initial catalog product",
      price: 1800,
      mrp: 2200,
      category_id: `${prefix}category`,
      amazon_asin: null,
      color: null,
      material: null,
      gsm: null,
      dimensions: null,
      weight_grams: null,
      items_in_set: 1,
      special_features: null,
      bullet_points: null,
      search_keywords: null,
      product_type: "towel",
      active: true,
      sort_order: 1,
      variant_colors: "[]",
      variant_sizes: "[]",
      wholesale_price: null,
    }]);
    assert.deepEqual(tagTypes.rows, [
      { id: `${prefix}tag-type`, name: "Merchandising", slug: `${prefix}merchandising`, description: "Initial signals", sort_order: 1 },
    ]);
    assert.deepEqual(tags.rows, [
      { id: `${prefix}new-tag`, name: "updated_tag", description: "Updated tag", tag_type_id: `${prefix}tag-type`, sort_order: 1 },
    ]);
    assert.deepEqual(productTags.rows, [
      { id: `${prefix}new-product-tag`, product_id: `${prefix}new-product`, tag_id: `${prefix}new-tag` },
    ]);
    assert.deepEqual(siteContent.rows, [{ key: "hero", value: "Updated hero copy" }]);

    for (const table of [
      "product_images",
      "product_reviews",
      "audience",
      "genders",
      "themes",
      "styles",
      "product_audience",
      "product_genders",
      "product_themes",
      "product_styles",
      "occasions",
      "category_tag_variant_configs",
      "variant_sizes",
      "variant_colors",
      "bulk_price_rules",
      "color_swatches",
      "category_size_definitions",
    ]) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      assert.deepEqual(result.rows, [], `${table} should match its empty incoming snapshot`);
    }
  }

  describe("catalog snapshot sync boundary", () => {
    it("leaves customer, order, cart, payment, and wishlist activity unchanged", async () => {
      await cleanupTransactionalRows();

      try {
        await seedDatabase(initialSnapshot);
        await seedTransactionalRows();
        const before = await readTransactionalRows();

        await seedDatabase(incomingSnapshot);

        await assertIncomingCatalog();
        assert.deepEqual(await readTransactionalRows(), before);
      } finally {
        await cleanupTransactionalRows();
      }
    });

    it("rolls back the catalog and shared content when an import fails", async () => {
      try {
        await seedDatabase(initialSnapshot);
        const before = await readCatalogAndSharedContent();

        await assert.rejects(
          () => seedDatabase(invalidIncomingSnapshot),
          /categorySizeDefinitions: unresolved category/,
        );

        assert.deepEqual(await readCatalogAndSharedContent(), before);
      } finally {
        await cleanupTransactionalRows();
      }
    });
  });
}