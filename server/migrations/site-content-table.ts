import { pool } from "../db";

// Keys that belong in site_content (shared content, syncs dev → prod).
// Everything else (seed-hash-*, brand-logo-*, brand-pwa-*, rate-limits,
// guest-cart-cleanup, security-alert-config, exchange-rate-alert-config,
// admin-emails, notification-bcc-config, cleanup-history, stats) stays in site_config.
const CONTENT_KEYS = [
  "featuredSections",
  "shop-sections",
  "homepage-collections",
  "homepageCollections",
  "seo",
  "announcement",
  "hero",
  "header",
  "footer",
  "offer-tiers",
  "delivery-tiers",
  "promise",
  "testimonials",
  "consent-popup",
  "pwa-install",
  "wishlist-signup-prompt",
];

export async function ensureSiteContentTable(): Promise<void> {
  // 1. Create site_content table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 2. Move well-known content keys from site_config → site_content
  if (CONTENT_KEYS.length > 0) {
    const placeholders = CONTENT_KEYS.map((_, i) => `$${i + 1}`).join(", ");
    await pool.query(
      `INSERT INTO site_content (key, value)
       SELECT key, value FROM site_config
       WHERE key IN (${placeholders})
       ON CONFLICT (key) DO NOTHING`,
      CONTENT_KEYS,
    );
    await pool.query(
      `DELETE FROM site_config WHERE key IN (${placeholders})`,
      CONTENT_KEYS,
    );
  }

  // 3. Move any page-* keys (page-terms, page-about, page-privacy, etc.)
  await pool.query(`
    INSERT INTO site_content (key, value)
    SELECT key, value FROM site_config
    WHERE key LIKE 'page-%'
    ON CONFLICT (key) DO NOTHING
  `);
  await pool.query(`DELETE FROM site_config WHERE key LIKE 'page-%'`);

  console.log("[migration] site-content-table: done");
}
