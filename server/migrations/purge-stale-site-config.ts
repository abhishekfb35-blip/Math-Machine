import { pool } from "../db";

/**
 * Purge site_config rows that have no live consumers:
 *
 *  - migration_enrich_v1   : one-time migration tracker (value "done"), never read at runtime
 *  - nudge-animation-config: leftover from a removed feature, no code reads it
 *  - rate-limit-config     : wrong key name — the rate-limiter reads/writes "rate-limits";
 *                            migrate the stored value to the correct key before deleting
 *
 * Valid site_config keys after this migration are documented in server/siteConfigKeys.ts.
 */
export async function purgeStaleConfigKeys(): Promise<void> {
  // Migrate rate-limit-config → rate-limits if the correct key doesn't exist yet
  const { rows: rateLimitsRows } = await pool.query(
    `SELECT 1 FROM site_config WHERE key = 'rate-limits' LIMIT 1`,
  );
  if (rateLimitsRows.length === 0) {
    const { rows: oldRows } = await pool.query(
      `SELECT value FROM site_config WHERE key = 'rate-limit-config' LIMIT 1`,
    );
    if (oldRows.length > 0) {
      await pool.query(
        `INSERT INTO site_config (key, value) VALUES ('rate-limits', $1)`,
        [oldRows[0].value],
      );
      console.log("[migration] purge-stale-site-config: copied rate-limit-config → rate-limits");
    }
  }

  await pool.query(
    `DELETE FROM site_config WHERE key IN ('migration_enrich_v1', 'nudge-animation-config', 'rate-limit-config')`,
  );
  console.log("[migration] purge-stale-site-config: removed 3 stale keys");
}
