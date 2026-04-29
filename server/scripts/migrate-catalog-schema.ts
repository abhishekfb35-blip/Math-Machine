/**
 * Migration: Catalog schema overhaul (Task #109)
 *
 * Replaces the flat `products.audience` column with multi-dimensional fields:
 *   - age_group  (kids | teens | adults | infant)
 *   - gender     (male | female | unisex)
 *   - themes     (comma-separated: animals, florals, ...)
 *   - styles     (comma-separated: minimal, initials, ...)
 *
 * Also:
 *   - Creates `tag_types` table for structured tag classification
 *   - Adds `tag_type_id` and `sort_order` columns to `tags`
 *   - Creates `occasions` table for merchandising engine
 *   - Deletes legacy audience-based tags and their product associations
 *   - Seeds 6 tag types and 25 internal merchandising tags
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 * Run with: npx tsx server/scripts/migrate-catalog-schema.ts
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[migrate] Starting catalog schema migration…");

  // ── 1. Add new product columns (idempotent) ──────────────────────────────
  await db.execute(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS age_group text,
      ADD COLUMN IF NOT EXISTS gender text,
      ADD COLUMN IF NOT EXISTS themes text,
      ADD COLUMN IF NOT EXISTS styles text;
  `);
  console.log("[migrate] products: ensured age_group/gender/themes/styles columns exist");

  // ── 2. Backfill age_group from audience ───────────────────────────────────
  const [{ count: unmigrated }] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM products WHERE age_group IS NULL AND audience IS NOT NULL
  `).catch(() => [{ count: "0" }]);  // audience column may already be dropped

  if (Number(unmigrated) > 0) {
    await db.execute(sql`
      UPDATE products
      SET age_group = CASE
          WHEN audience = 'couples' THEN 'adults'
          WHEN audience IN ('kids', 'teens', 'adults', 'infant') THEN audience
          ELSE 'kids'
        END,
        gender = 'unisex'
      WHERE age_group IS NULL;
    `);
    console.log(`[migrate] products: backfilled age_group for ${unmigrated} rows`);
  } else {
    // Also ensure any remaining NULLs (audience already gone) are set
    await db.execute(sql`
      UPDATE products SET age_group = 'kids', gender = 'unisex' WHERE age_group IS NULL;
    `);
    console.log("[migrate] products: ensured no NULL age_group/gender values");
  }

  // ── 3. Create tag_types table (idempotent) ────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tag_types (
      id        text PRIMARY KEY,
      name      text NOT NULL UNIQUE,
      slug      text NOT NULL UNIQUE,
      description text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("[migrate] tag_types: table ensured");

  // ── 4. Add columns to tags (idempotent) ───────────────────────────────────
  await db.execute(sql`
    ALTER TABLE tags
      ADD COLUMN IF NOT EXISTS tag_type_id text REFERENCES tag_types(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS sort_order  integer NOT NULL DEFAULT 0;
  `);
  console.log("[migrate] tags: ensured tag_type_id/sort_order columns");

  // ── 5. Create occasions table (idempotent) ────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS occasions (
      id                text PRIMARY KEY,
      name              text NOT NULL,
      slug              text NOT NULL UNIQUE,
      description       text,
      boost_tags        jsonb NOT NULL DEFAULT '[]',
      penalty_tags      jsonb NOT NULL DEFAULT '[]',
      preferred_styles  text,
      preferred_themes  text,
      active            boolean NOT NULL DEFAULT true,
      sort_order        integer NOT NULL DEFAULT 0,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("[migrate] occasions: table ensured");

  // ── 6. Remove legacy audience-based tags and product_tags ─────────────────
  const legacyTagNames = [
    "Kids bathrobes", "adult bathrobes", "couple bathrobes",
    "adult towels", "couple towels", "kids blankets", "kids towels",
    "Princess", "Superhero",
  ];

  const placeholders = legacyTagNames.map((_, i) => `$${i + 1}`).join(", ");
  const [{ count: ptCount }] = await db.execute<{ count: string }>(sql.raw(`
    DELETE FROM product_tags
    WHERE tag_id IN (SELECT id FROM tags WHERE name IN (${placeholders}))
    RETURNING (SELECT COUNT(*) FROM product_tags)
  `, ...legacyTagNames)).catch(() => [{ count: "0" }]);

  const [{ count: tagCount }] = await db.execute<{ count: string }>(sql.raw(`
    WITH deleted AS (
      DELETE FROM tags WHERE name IN (${placeholders}) RETURNING id
    ) SELECT COUNT(*) as count FROM deleted
  `, ...legacyTagNames)).catch(() => [{ count: "0" }]);

  console.log(`[migrate] legacy tags: deleted ${tagCount} tags and their product_tag associations`);

  // ── 7. Seed tag types ─────────────────────────────────────────────────────
  const tagTypeRows = [
    { id: "n7k4y0t47ddlv81ocw0uh0g5", name: "Merchandising",         slug: "merchandising",      description: "Selling and ranking signals",               sort_order: 1 },
    { id: "aetcsgfd4ds0127a5ugkxgm9", name: "Occasion-fit",          slug: "occasion-fit",       description: "Soft signals for occasion-based ranking",   sort_order: 2 },
    { id: "jbm38fz4f9hwfttj0h63gvgh", name: "Risk / Suitability",    slug: "risk-suitability",   description: "Buyer confidence and safety signals",       sort_order: 3 },
    { id: "mfp285l1s0f1f357ytju67bv", name: "Operational",           slug: "operational",        description: "Fulfillment and production signals",        sort_order: 4 },
    { id: "m1jmc4n2iqd7l25b7fcmrzsy", name: "Experimental / Growth", slug: "experimental-growth",description: "Testing and seasonal signals",              sort_order: 5 },
    { id: "hezlv1bhytd61jmwgvoy26zk", name: "Use-Case / Structure",  slug: "use-case-structure", description: "Product format and set signals",            sort_order: 6 },
  ];

  for (const tt of tagTypeRows) {
    await db.execute(sql`
      INSERT INTO tag_types (id, name, slug, description, sort_order)
      VALUES (${tt.id}, ${tt.name}, ${tt.slug}, ${tt.description}, ${tt.sort_order})
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`[migrate] tag_types: seeded ${tagTypeRows.length} types`);

  // ── 8. Seed the 25 internal merchandising tags ────────────────────────────
  const M = "n7k4y0t47ddlv81ocw0uh0g5";   // Merchandising
  const O = "aetcsgfd4ds0127a5ugkxgm9";   // Occasion-fit
  const R = "jbm38fz4f9hwfttj0h63gvgh";   // Risk/Suitability
  const P = "mfp285l1s0f1f357ytju67bv";   // Operational
  const E = "m1jmc4n2iqd7l25b7fcmrzsy";   // Experimental/Growth
  const U = "hezlv1bhytd61jmwgvoy26zk";   // Use-Case/Structure

  const newTags = [
    { id: "z8dzycxb18hli2lln4ry8a09", name: "best_seller",          description: "Consistently high sales volume",                tagTypeId: M, sortOrder: 1 },
    { id: "ikbv8i371t9spw6ktqbijzgu", name: "high_conversion",      description: "High add-to-cart to purchase rate",            tagTypeId: M, sortOrder: 2 },
    { id: "le16f5nzuzzvm1gtami0nt6w", name: "bundle_friendly",      description: "Works well in gift bundles",                   tagTypeId: M, sortOrder: 3 },
    { id: "ce324boqqci8lenvztb9fi9b", name: "bulk_friendly",        description: "Frequently ordered in large quantities",       tagTypeId: M, sortOrder: 4 },
    { id: "qtdbppqeyw72g1lqekhtwpo9", name: "repeat_ordered",       description: "Customers reorder this item",                  tagTypeId: M, sortOrder: 5 },
    { id: "r7ovadnrzngh8hc6v99wrln8", name: "good_for_return_gifts",description: "Strong fit for return gift scenarios",         tagTypeId: O, sortOrder: 1 },
    { id: "qq0st5hs1zg0hzjujbubotmh", name: "good_for_wedding_gifts",description:"Strong fit for wedding gifting",              tagTypeId: O, sortOrder: 2 },
    { id: "ddk0c1ef78s25du6m469jw09", name: "good_for_corporate",   description: "Works for corporate bulk gifting",            tagTypeId: O, sortOrder: 3 },
    { id: "xjjc6w5m6v8oiba1dpnw21s2", name: "safe_for_mixed_gender",description: "Design appeals to all genders",              tagTypeId: R, sortOrder: 1 },
    { id: "jhmnu0k5yeb7sfyziysq1zxw", name: "kid_safe_design",      description: "No adult themes, safe for children",          tagTypeId: R, sortOrder: 2 },
    { id: "m16t4w4enl3im1npwokdxese", name: "universal_appeal",     description: "Works across age groups",                     tagTypeId: R, sortOrder: 3 },
    { id: "jq3ppsesbqnlprr89ey8499j", name: "niche_design",         description: "Specific audience, not broadly safe for gifting", tagTypeId: R, sortOrder: 4 },
    { id: "tjx9if73o1v8ev8z26z1nklb", name: "fast_moving",          description: "High inventory turnover",                     tagTypeId: P, sortOrder: 1 },
    { id: "cjn9u2cyr9dikfvh3yj7oc79", name: "easy_to_personalise",  description: "Simple embroidery, quick production",         tagTypeId: P, sortOrder: 2 },
    { id: "c5ewm6udsn0vcjrwfbkd750d", name: "low_stock_risk",       description: "Always available, reliable supply",           tagTypeId: P, sortOrder: 3 },
    { id: "zq8bh0s2r41bfyrw78m2607v", name: "quick_production",     description: "Can be fulfilled faster than usual",          tagTypeId: P, sortOrder: 4 },
    { id: "b4cf8cnuevgqf0t3eoriv0t6", name: "new_arrival",          description: "Recently added to catalog",                   tagTypeId: E, sortOrder: 1 },
    { id: "lm4xjzvsiubet60snqaryb7k", name: "seasonal",             description: "Relevant to a specific season or period",     tagTypeId: E, sortOrder: 2 },
    { id: "dbgennshfhevxhy366isnimm", name: "test_category",        description: "Under observation / trial listing",           tagTypeId: E, sortOrder: 3 },
    { id: "vcaux05w2d6tb1ukfpk9qq00", name: "couple_set",           description: "Product designed as a pair for couples",      tagTypeId: U, sortOrder: 1 },
    { id: "uwut512nd63zfqwg1f6nzhrc", name: "pair_product",         description: "Two matching items sold together",             tagTypeId: U, sortOrder: 2 },
    { id: "t1gmllfkc3hyvbld1o11bh8k", name: "family_set",          description: "Multi-piece set for families",                tagTypeId: U, sortOrder: 3 },
    { id: "enm0kudwbeptobpnb1lbafmz", name: "single_piece",        description: "Individual item, not a set",                  tagTypeId: U, sortOrder: 4 },
    { id: "yl4xhwsy9tbx4pteukkri03g", name: "bundle_pack",         description: "Pre-bundled multi-item offering",             tagTypeId: U, sortOrder: 5 },
    { id: "ddb00q96z8ye8fcd6ecjeyds", name: "return_gift_pack",    description: "Packaged specifically for return gifts",      tagTypeId: U, sortOrder: 6 },
  ];

  for (const tag of newTags) {
    await db.execute(sql`
      INSERT INTO tags (id, name, description, tag_type_id, sort_order)
      VALUES (${tag.id}, ${tag.name}, ${tag.description}, ${tag.tagTypeId}, ${tag.sortOrder})
      ON CONFLICT (id) DO UPDATE SET
        tag_type_id = EXCLUDED.tag_type_id,
        sort_order  = EXCLUDED.sort_order;
    `);
  }
  console.log(`[migrate] tags: seeded ${newTags.length} typed tags`);

  // ── 9. Drop audience column (idempotent — safe if already dropped) ─────────
  await db.execute(sql`
    ALTER TABLE products DROP COLUMN IF EXISTS audience;
  `);
  console.log("[migrate] products: audience column dropped (or was already gone)");

  console.log("[migrate] Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] FATAL:", err);
  process.exit(1);
});
