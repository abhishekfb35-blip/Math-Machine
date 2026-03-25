import { createId } from "@paralleldrive/cuid2";
import { db } from "../db";
import { sql } from "drizzle-orm";

type CountRow = { cnt: string };

const PINK_FABRIC_URL = "/images/products/pink_fabric.jpg";
const EMB_URL = "/images/products/emb.jpg";

export async function ensurePinkKidsTowelGallery() {
  try {
    const countResult = await db.execute<CountRow>(sql`
      SELECT COUNT(*)::text AS cnt
      FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      JOIN product_tags pt ON pt.product_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.product_type = 'towel'
        AND LOWER(t.name) LIKE '%kids%towel%'
        AND LOWER(p.color) LIKE '%pink%'
        AND pi.sort_order = 2
        AND pi.image_url = ${PINK_FABRIC_URL}
    `);
    const countRows: CountRow[] = Array.isArray(countResult)
      ? countResult
      : (countResult as { rows: CountRow[] }).rows ?? [];
    const alreadyDone = Number(countRows[0]?.cnt ?? 0);

    type IdRow = { id: string };
    const productResult = await db.execute<IdRow>(sql`
      SELECT DISTINCT p.id
      FROM products p
      JOIN product_tags pt ON pt.product_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.product_type = 'towel'
        AND LOWER(t.name) LIKE '%kids%towel%'
        AND LOWER(p.color) LIKE '%pink%'
    `);
    const productRows: IdRow[] = Array.isArray(productResult)
      ? productResult
      : (productResult as { rows: IdRow[] }).rows ?? [];

    if (alreadyDone >= productRows.length && productRows.length > 0) {
      console.log("[migration] pink-kids-towels-gallery: already applied, skipping");
      return;
    }

    let upserted = 0;
    for (const { id: productId } of productRows) {
      await db.execute(sql`
        DELETE FROM product_images
        WHERE product_id = ${productId} AND sort_order IN (2, 3)
      `);

      const now = new Date();
      await db.execute(sql`
        INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary, created_at, updated_at)
        VALUES
          (${createId()}, ${productId}, ${PINK_FABRIC_URL}, 2, false, ${now}, ${now}),
          (${createId()}, ${productId}, ${EMB_URL},          3, false, ${now}, ${now})
      `);
      upserted++;
    }

    console.log(`[migration] pink-kids-towels-gallery: set gallery images for ${upserted} products`);
  } catch (err: unknown) {
    console.error("[migration] pink-kids-towels-gallery failed:", err instanceof Error ? err.message : String(err));
  }
}
