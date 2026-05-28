import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureAudienceVariantConfig() {
  await db.execute(sql`
    ALTER TABLE category_tag_variant_configs
    ADD COLUMN IF NOT EXISTS audience_id TEXT
  `);
  console.log("[migration] audience-variant-config: audience_id column ensured");
}
