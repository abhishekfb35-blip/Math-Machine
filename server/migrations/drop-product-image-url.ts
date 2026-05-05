import { db } from "../db";
import { sql } from "drizzle-orm";

export async function dropProductImageUrl(): Promise<void> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_url'
  `);
  if (result.rows.length === 0) {
    console.log("[migration] drop-product-image-url: column already gone, skipping");
    return;
  }
  await db.execute(sql`ALTER TABLE products DROP COLUMN image_url`);
  console.log("[migration] drop-product-image-url: image_url column dropped from products table");
}
