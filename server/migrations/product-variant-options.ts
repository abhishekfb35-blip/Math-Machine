import { db } from "../db";
import { sql } from "drizzle-orm";

function rows(res: unknown): unknown[] {
  return Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
}

export async function ensureProductVariantColumns() {
  const colorsCheck = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'variant_colors'
  `);
  if (rows(colorsCheck).length === 0) {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_colors TEXT NOT NULL DEFAULT '[]'`);
    console.log("[migration] product-variant-options: added variant_colors to products");
  }

  const sizesCheck = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'variant_sizes'
  `);
  if (rows(sizesCheck).length === 0) {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_sizes TEXT NOT NULL DEFAULT '[]'`);
    console.log("[migration] product-variant-options: added variant_sizes to products");
  }

  console.log("[migration] product-variant-options: complete");
}
