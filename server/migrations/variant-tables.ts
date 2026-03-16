import { db } from "../db";
import { sql } from "drizzle-orm";

function rows(res: unknown): unknown[] {
  return Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
}

export async function ensureVariantTables() {
  try {
    const checkResult = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'category_variant_options'
      ) as exists
    `);
    const tableRows = rows(checkResult);
    if (!(tableRows[0] as { exists?: boolean })?.exists) {
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
    const pvRows = rows(pvCheck);
    if (!(pvRows[0] as { exists?: boolean })?.exists) {
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

    const cartColorCheck = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cart_items' AND column_name = 'selected_color'
    `);
    if (rows(cartColorCheck).length === 0) {
      await db.execute(sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_color TEXT`);
      await db.execute(sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_color/selected_size to cart_items");
    }

    const orderColorCheck = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'selected_color'
    `);
    if (rows(orderColorCheck).length === 0) {
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_color TEXT`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_color/selected_size to order_items");
    }

    console.log("[migration] variant-tables: complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[migration] variant-tables failed:", msg);
  }
}
