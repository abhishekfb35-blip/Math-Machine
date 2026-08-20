import { sql } from "drizzle-orm";
import { db } from "../db";

export async function ensureCustomerProfileDateColumns() {
  await db.execute(sql`
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS birthday_month_day TEXT,
      ADD COLUMN IF NOT EXISTS anniversary_month_day TEXT
  `);
  console.log("[migration] customer-profile-dates: customer date columns are ready");
}