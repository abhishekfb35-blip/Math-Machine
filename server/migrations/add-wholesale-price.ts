import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addWholesalePriceColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS wholesale_price INTEGER
  `);
}
