import { db } from "../db";
import { sql } from "drizzle-orm";

export async function consolidateProductImages(): Promise<void> {
  // Step 1: Insert sort_order=0 for products that have NO sort_order=0 row at all.
  await db.execute(sql`
    INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary, created_at, updated_at)
    SELECT
      gen_random_uuid()::text,
      p.id,
      p.image_url,
      0,
      true,
      now(),
      now()
    FROM products p
    WHERE p.image_url IS NOT NULL
      AND p.image_url != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_images pi
        WHERE pi.product_id = p.id AND pi.sort_order = 0
      )
  `);

  // Step 2: Fix products whose sort_order=0 row exists but doesn't match products.image_url.
  // products.image_url is absent from the gallery entirely for these products, so we:
  //   a) Shift all their existing gallery rows up by 1 (makes position 0 vacant)
  //   b) Insert products.image_url as the new sort_order=0 row
  // Must increment first to avoid unique-constraint conflicts on (product_id, sort_order).
  // A CTE identifies the mismatched set once and drives both operations.
  await db.execute(sql`
    WITH mismatched AS (
      SELECT p.id AS product_id, p.image_url
      FROM products p
      JOIN product_images pi0 ON pi0.product_id = p.id AND pi0.sort_order = 0
      WHERE p.image_url IS NOT NULL
        AND p.image_url != ''
        AND pi0.image_url != p.image_url
    ),
    shifted AS (
      UPDATE product_images pi
      SET sort_order = pi.sort_order + 1,
          is_primary = false,
          updated_at = now()
      FROM mismatched m
      WHERE pi.product_id = m.product_id
      RETURNING pi.product_id
    )
    INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary, created_at, updated_at)
    SELECT
      gen_random_uuid()::text,
      m.product_id,
      m.image_url,
      0,
      true,
      now(),
      now()
    FROM mismatched m
  `);

  // Verify: log remaining mismatches (should be 0 after both steps).
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS remaining
    FROM products p
    JOIN product_images pi ON pi.product_id = p.id AND pi.sort_order = 0
    WHERE p.image_url IS NOT NULL
      AND p.image_url != ''
      AND pi.image_url != p.image_url
  `);
  const remaining = Number((result.rows[0] as Record<string, unknown>).remaining ?? 0);
  if (remaining === 0) {
    console.log("[consolidateProductImages] All products have correct sort_order=0 primary image.");
  } else {
    console.warn(`[consolidateProductImages] WARNING: ${remaining} products still have a mismatched sort_order=0 row.`);
  }
}
