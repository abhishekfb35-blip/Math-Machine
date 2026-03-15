import { db } from "../db";
import { sql } from "drizzle-orm";

export async function migrateSiteConfigKeyPk() {
  try {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'site_config' AND column_name = 'id'
    `);
    const rows = Array.isArray(result) ? result : (result as any).rows ?? [];

    if (rows.length === 0) {
      console.log("[migrate-site-config-pk] Already migrated, skipping");
      return;
    }

    console.log("[migrate-site-config-pk] Removing id column, making key the primary key...");

    const ucResult = await db.execute(sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'site_config' AND constraint_type = 'UNIQUE'
    `);
    const ucRows = Array.isArray(ucResult) ? ucResult : (ucResult as any).rows ?? [];

    await db.execute(sql`ALTER TABLE site_config DROP CONSTRAINT IF EXISTS site_config_pkey`);

    for (const uc of ucRows) {
      await db.execute(
        sql.raw(`ALTER TABLE site_config DROP CONSTRAINT IF EXISTS "${uc.constraint_name}"`)
      );
    }

    await db.execute(sql`ALTER TABLE site_config DROP COLUMN IF EXISTS id`);
    await db.execute(sql`ALTER TABLE site_config ADD CONSTRAINT site_config_pkey PRIMARY KEY (key)`);

    console.log("[migrate-site-config-pk] Done. key is now the primary key of site_config");
  } catch (err: any) {
    console.error("[migrate-site-config-pk] Failed:", err.message);
    throw err;
  }
}
