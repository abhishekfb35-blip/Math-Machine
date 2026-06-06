import { pool } from "../db";

/**
 * Remove the cart-banners site_config key.
 * The supplementary text feature has been removed from NudgeCard — this key
 * has no live consumers and the admin UI form has been deleted.
 */
export async function purgeCartBannersKey(): Promise<void> {
  await pool.query(`DELETE FROM site_config WHERE key = 'cart-banners'`);
  console.log("[migration] purge-cart-banners: removed cart-banners key");
}
