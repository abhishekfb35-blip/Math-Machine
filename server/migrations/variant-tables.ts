import { db } from "../db";
import { sql } from "drizzle-orm";

const DEFAULT_KIDS_SIZES = JSON.stringify([
  { name: "Small", value: "S", description: "60 × 30 cm", isDefault: false, blurOnFront: false, hideFromFront: false },
  { name: "Medium", value: "M", description: "90 × 45 cm", isDefault: false, blurOnFront: false, hideFromFront: false },
  { name: "Large", value: "L", description: "120 × 60 cm", isDefault: true, blurOnFront: false, hideFromFront: false },
]);

const DEFAULT_ADULT_SIZES = JSON.stringify([
  { name: "Medium", value: "M", description: "140 × 70 cm", isDefault: false, blurOnFront: false, hideFromFront: false },
  { name: "Large", value: "L", description: "150 × 75 cm", isDefault: true, blurOnFront: false, hideFromFront: false },
  { name: "XLarge", value: "XL", description: "160 × 80 cm", isDefault: false, blurOnFront: false, hideFromFront: false },
]);

export async function ensureVariantTables() {
  try {
    const checkResult = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'category_variant_options'
      ) as exists
    `);
    const rows = Array.isArray(checkResult) ? checkResult : (checkResult as any).rows ?? [];
    if (!rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS category_variant_options (
          category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
          colors TEXT NOT NULL DEFAULT '[]',
          sizes TEXT NOT NULL DEFAULT '[]'
        )
      `);
      console.log("[migration] variant-tables: created category_variant_options");
    }

    const pvCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_variants'
      ) as exists
    `);
    const pvRows = Array.isArray(pvCheck) ? pvCheck : (pvCheck as any).rows ?? [];
    if (!pvRows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS product_variants (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          color TEXT NOT NULL,
          size TEXT NOT NULL,
          available BOOLEAN NOT NULL DEFAULT true
        )
      `);
      console.log("[migration] variant-tables: created product_variants");
    }

    const cartColorCheck = await db.execute<{ exists: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cart_items' AND column_name = 'selected_color'
    `);
    const cartColorRows = Array.isArray(cartColorCheck) ? cartColorCheck : (cartColorCheck as any).rows ?? [];
    if (cartColorRows.length === 0) {
      await db.execute(sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_color TEXT`);
      await db.execute(sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_color/selected_size to cart_items");
    }

    const orderColorCheck = await db.execute<{ exists: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'selected_color'
    `);
    const orderColorRows = Array.isArray(orderColorCheck) ? orderColorCheck : (orderColorCheck as any).rows ?? [];
    if (orderColorRows.length === 0) {
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_color TEXT`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_color/selected_size to order_items");
    }

    console.log("[migration] variant-tables: complete");
  } catch (err: any) {
    console.error("[migration] variant-tables failed:", err.message);
  }
}
