import { db } from "../db";
import { sql } from "drizzle-orm";

function rows(res: unknown): unknown[] {
  return Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
}

export async function ensureVariantSizeFontColumn() {
  const check = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'variant_sizes'
      AND column_name = 'description_font_size'
  `);
  if (rows(check).length === 0) {
    await db.execute(sql`
      ALTER TABLE variant_sizes ADD COLUMN description_font_size INTEGER DEFAULT 12
    `);
    console.log("[migration] variant-size-font: added description_font_size column");
  }
}
