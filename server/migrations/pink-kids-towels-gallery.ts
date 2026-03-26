import { createId } from "@paralleldrive/cuid2";
import { db } from "../db";
import { sql } from "drizzle-orm";

const PINK_FABRIC_URL = "/images/products/pink_fabric.jpg";
const EMB_URL = "/images/products/emb.jpg";

export async function ensurePinkKidsTowelGallery() {
  try {
    type IdRow = { id: string };
    const productResult = await db.execute<IdRow>(sql`
      SELECT DISTINCT p.id
      FROM products p
      JOIN product_tags pt ON pt.product_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.product_type = 'towel'
        AND LOWER(t.name) = 'kids towels'
        AND LOWER(p.color) LIKE '%pink%'
    `);
    const productRows: IdRow[] = Array.isArray(productResult)
      ? productResult
      : (productResult as { rows: IdRow[] }).rows ?? [];

    if (productRows.length === 0) {
      console.log("[migration] pink-kids-towels-gallery: no matching products found, skipping");
      return;
    }

    let upserted = 0;
    for (const { id: productId } of productRows) {
      type CountRow = { count: string };
      const uploadedCheck = await db.execute<CountRow>(sql`
        SELECT COUNT(*) as count FROM product_images
        WHERE product_id = ${productId} AND image_url LIKE '/uploads/%'
      `);
      const uploadedRows: CountRow[] = Array.isArray(uploadedCheck)
        ? uploadedCheck
        : (uploadedCheck as { rows: CountRow[] }).rows ?? [];
      const hasUserUploads = parseInt(uploadedRows[0]?.count ?? "0", 10) > 0;
      if (hasUserUploads) continue;

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
