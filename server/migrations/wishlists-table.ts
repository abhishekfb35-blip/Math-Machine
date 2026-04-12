import { pool } from "../db";

export async function ensureWishlistsTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (customer_id, product_id)
      )
    `);
    console.log("wishlists table ensured");
  } catch (err: any) {
    console.warn("Could not ensure wishlists table:", err.message);
  }
}
