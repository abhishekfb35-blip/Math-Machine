import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureRateLimitStatsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limit_stats (
      id TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      endpoint_category TEXT NOT NULL,
      bucket_hour TIMESTAMPTZ NOT NULL,
      block_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_stats_tier_cat_hour_uniq
    ON rate_limit_stats (tier, endpoint_category, bucket_hour)
  `);
}
