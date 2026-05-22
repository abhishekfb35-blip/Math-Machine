import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureSkuNotNull() {
  const result = await db.execute<{ is_nullable: string }>(sql`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sku'
  `);
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  const row = rows[0];
  if (!row) {
    console.log("[migration] sku-not-null: products.sku column not found, skipping");
    return;
  }
  if (row.is_nullable === "NO") {
    console.log("[migration] sku-not-null: already NOT NULL, skipping");
    return;
  }
  await db.execute(sql`ALTER TABLE products ALTER COLUMN sku SET NOT NULL`);
  console.log("[migration] sku-not-null: applied NOT NULL constraint to products.sku");
}
