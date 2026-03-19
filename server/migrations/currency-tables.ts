import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureCurrencyTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS currency_rates (
        currency VARCHAR(10) PRIMARY KEY,
        rate_from_inr NUMERIC(12,6) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[migration] currency-tables: currency_rates ensured");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id TEXT PRIMARY KEY,
        currency VARCHAR(10) NOT NULL UNIQUE,
        symbol VARCHAR(10) NOT NULL,
        display_name TEXT,
        markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        rounding_rule TEXT NOT NULL DEFAULT 'nearest',
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[migration] currency-tables: pricing_rules ensured");

    const currencyColResult = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'currency'
    `);
    const rows = Array.isArray(currencyColResult) ? currencyColResult : (currencyColResult as any).rows ?? [];
    if (rows.length === 0) {
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`);
      console.log("[migration] currency-tables: added orders.currency column");
    } else {
      console.log("[migration] currency-tables: orders.currency already exists, skipping");
    }

    console.log("[migration] currency-tables: complete");
  } catch (err: any) {
    console.error("[migration] currency-tables failed:", err.message);
  }
}
