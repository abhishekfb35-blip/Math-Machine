import { pool } from "../db";

export async function ensureWishlistsTable(): Promise<void> {
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
}
