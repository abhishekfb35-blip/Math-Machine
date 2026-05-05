import { db } from "../db";
import { sql } from "drizzle-orm";

export async function consolidateProductImages(): Promise<void> {
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
}
