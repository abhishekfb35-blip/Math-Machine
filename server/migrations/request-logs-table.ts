import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureRequestLogsTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER,
      user_agent TEXT,
      session_id TEXT,
      customer_id TEXT,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS request_logs_created_at_idx ON request_logs (created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS request_logs_ip_idx ON request_logs (ip)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ip_geo_cache (
      ip TEXT PRIMARY KEY,
      country TEXT,
      city TEXT,
      cached_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
