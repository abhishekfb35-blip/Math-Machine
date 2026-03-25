import { db } from "../db";
import { sql } from "drizzle-orm";

type ColumnRow = { column_name: string };

export async function ensureCartCustomerColumns() {
  try {
    const result = await db.execute<ColumnRow>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'carts' AND column_name = 'customer_id'
    `);
    const rows: ColumnRow[] = Array.isArray(result) ? result : (result as { rows: ColumnRow[] }).rows ?? [];
    if (rows.length === 0) {
      await db.execute(sql`ALTER TABLE carts ADD COLUMN IF NOT EXISTS customer_id TEXT`);
      await db.execute(sql`ALTER TABLE carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE carts ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMP`);
      console.log("[migration] add-cart-customer: added customer_id, updated_at, abandoned_email_sent_at columns");
    } else {
      await db.execute(sql`ALTER TABLE carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE carts ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMP`);
      console.log("[migration] add-cart-customer: columns already exist or partially added");
    }
  } catch (err: unknown) {
    console.error("[migration] add-cart-customer failed:", err instanceof Error ? err.message : String(err));
  }
}
