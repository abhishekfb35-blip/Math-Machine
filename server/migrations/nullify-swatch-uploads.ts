import { pool } from "../db";

export async function nullifySwatchUploads(): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE variant_colors SET swatch_url = NULL WHERE swatch_url LIKE '/uploads/%'`
  );
  if (rowCount && rowCount > 0) {
    console.log(`[nullify-swatch-uploads] Cleared ${rowCount} broken /uploads/ swatch URL(s)`);
  }
}
