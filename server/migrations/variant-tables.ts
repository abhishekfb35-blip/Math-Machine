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
      console.log("[migration] variant-tables: added selected_color to cart_items");
    }
    const cartSizeCheck = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cart_items' AND column_name = 'selected_size'
    `);
    if (rows(cartSizeCheck).length === 0) {
      await db.execute(sql`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_size to cart_items");
    }

    const orderColorCheck = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'selected_color'
    `);
    if (rows(orderColorCheck).length === 0) {
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_color TEXT`);
      console.log("[migration] variant-tables: added selected_color to order_items");
    }
    const orderSizeCheck = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'selected_size'
    `);
    if (rows(orderSizeCheck).length === 0) {
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_size TEXT`);
      console.log("[migration] variant-tables: added selected_size to order_items");
    }

    const ctvcCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'category_tag_variant_configs'
      ) as exists
    `);
    const ctvcRows = rows(ctvcCheck);
    if (!(ctvcRows[0] as { exists?: boolean })?.exists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS category_tag_variant_configs (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          tag_id TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT uq_category_tag UNIQUE (category_id, tag_id)
        )
      `);
      console.log("[migration] variant-tables: created category_tag_variant_configs");
    } else {
      await db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_category_tag'
          ) THEN
            ALTER TABLE category_tag_variant_configs ADD CONSTRAINT uq_category_tag UNIQUE (category_id, tag_id);
          END IF;
        END $$;
      `);
    }

    const vsCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'variant_sizes'
      ) as exists
    `);
    const vsRows = rows(vsCheck);
    if (!(vsRows[0] as { exists?: boolean })?.exists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS variant_sizes (
          id TEXT PRIMARY KEY,
          config_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          price_add INTEGER NOT NULL DEFAULT 0,
          is_default BOOLEAN NOT NULL DEFAULT false,
          blur_on_front BOOLEAN NOT NULL DEFAULT false,
          sort_order INTEGER NOT NULL DEFAULT 0
        )
      `);
      console.log("[migration] variant-tables: created variant_sizes");
    }

    const vcCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'variant_colors'
      ) as exists
    `);
    const vcRows = rows(vcCheck);
    if (!(vcRows[0] as { exists?: boolean })?.exists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS variant_colors (
          id TEXT PRIMARY KEY,
          size_id TEXT NOT NULL,
          name TEXT NOT NULL,
          swatch_url TEXT,
          blur_on_front BOOLEAN NOT NULL DEFAULT false,
          sort_order INTEGER NOT NULL DEFAULT 0
        )
      `);
      console.log("[migration] variant-tables: created variant_colors");
    }

    console.log("[migration] variant-tables: complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[migration] variant-tables failed:", msg);
  }
}
