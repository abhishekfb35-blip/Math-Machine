import { db } from "../db";
import { sql } from "drizzle-orm";

export async function migrateSiteConfigKeyPk() {
  try {
    const idColResult = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'site_config' AND column_name = 'id'
    `);
    const idColRows = Array.isArray(idColResult) ? idColResult : (idColResult as any).rows ?? [];
    const hasIdCol = idColRows.length > 0;

    const keyPkResult = await db.execute(sql`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
      WHERE tc.table_name = 'site_config' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'key'
    `);
    const keyPkRows = Array.isArray(keyPkResult) ? keyPkResult : (keyPkResult as any).rows ?? [];
    const keyIsAlreadyPk = keyPkRows.length > 0;

    if (!hasIdCol && keyIsAlreadyPk) {
      console.log("[migrate-site-config-pk] Already migrated, skipping");
      return;
    }

    console.log("[migrate-site-config-pk] Migrating site_config: removing id, making key the primary key...");

    const allPkResult = await db.execute(sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'site_config' AND constraint_type = 'PRIMARY KEY'
    `);
    const allPkRows = Array.isArray(allPkResult) ? allPkResult : (allPkResult as any).rows ?? [];
    for (const pk of allPkRows) {
      await db.execute(sql.raw(`ALTER TABLE site_config DROP CONSTRAINT IF EXISTS "${pk.constraint_name}"`));
    }

    const ucResult = await db.execute(sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'site_config' AND constraint_type = 'UNIQUE'
    `);
    const ucRows = Array.isArray(ucResult) ? ucResult : (ucResult as any).rows ?? [];
    for (const uc of ucRows) {
      await db.execute(sql.raw(`ALTER TABLE site_config DROP CONSTRAINT IF EXISTS "${uc.constraint_name}"`));
    }

    if (hasIdCol) {
      await db.execute(sql`ALTER TABLE site_config DROP COLUMN IF EXISTS id`);
    }

    if (!keyIsAlreadyPk) {
      try {
        await db.execute(sql`ALTER TABLE site_config ADD CONSTRAINT site_config_pkey PRIMARY KEY (key)`);
      } catch (e: any) {
        if (e.message?.includes("multiple primary keys") || e.code === "42P16") {
          console.log("[migrate-site-config-pk] key was already set as PK concurrently, continuing");
        } else {
          throw e;
        }
      }
    }

    console.log("[migrate-site-config-pk] Done. key is now the primary key of site_config");
  } catch (err: any) {
    console.error("[migrate-site-config-pk] Failed:", err.message);
    throw err;
  }
}
