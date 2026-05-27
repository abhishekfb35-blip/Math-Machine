import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runColorSizeReposMigration() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS color_swatches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      swatch_url TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS category_size_definitions (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  console.log("[migration] color-size-repos: tables ensured");
}
