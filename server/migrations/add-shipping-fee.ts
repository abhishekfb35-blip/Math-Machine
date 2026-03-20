import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureShippingFeeColumn() {
  try {
    const result = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'shipping_fee'
    `);
    const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
    if (rows.length === 0) {
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee INTEGER NOT NULL DEFAULT 0`);
      console.log("[migration] add-shipping-fee: added orders.shipping_fee column");
    } else {
      console.log("[migration] add-shipping-fee: already exists, skipping");
    }
  } catch (err: any) {
    console.error("[migration] add-shipping-fee failed:", err.message);
  }
}
