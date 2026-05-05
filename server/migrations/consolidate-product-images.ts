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
  // For these, products.image_url is absent from the gallery entirely, so we must:
  //   a) Shift all existing gallery rows up by 1 (to make room for position 0)
  //   b) Insert products.image_url as the new sort_order=0 row
  // Must increment first to avoid unique-constraint conflicts on (product_id, sort_order).

  // 2a: Increment sort_order for all rows belonging to mismatched products.
  const shifted = await db.execute(sql`
    UPDATE product_images pi
    SET sort_order = pi.sort_order + 1,
        is_primary = false,
        updated_at = now()
    WHERE pi.product_id IN (
      SELECT p.id
      FROM products p
      JOIN product_images pi2 ON pi2.product_id = p.id AND pi2.sort_order = 0
      WHERE p.image_url IS NOT NULL
        AND p.image_url != ''
        AND pi2.image_url != p.image_url
    )
  `);

  // 2b: Insert the correct primary image at sort_order=0.
  const inserted = await db.execute(sql`
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

  const shiftedCount = (shifted as any).rowCount ?? 0;
  const insertedCount = (inserted as any).rowCount ?? 0;
  if (shiftedCount > 0 || insertedCount > 0) {
    console.log(
      `[consolidateProductImages] Fixed ${insertedCount} mismatched products — shifted ${shiftedCount} gallery rows up, inserted ${insertedCount} new primary rows`
    );
  }
}
