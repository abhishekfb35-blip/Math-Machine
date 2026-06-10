import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureCategoryAudiencePricingTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS category_audience_pricing (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      audience_id TEXT NOT NULL REFERENCES audience(id) ON DELETE CASCADE,
      wholesale_price INTEGER NOT NULL,
      UNIQUE(category_id, audience_id)
    )
  `);
  console.log("[migration] category-audience-pricing: table ensured");
}
