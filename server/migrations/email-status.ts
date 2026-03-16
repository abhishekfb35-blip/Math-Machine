import { db } from "../db";
import { sql } from "drizzle-orm";

function rows(res: unknown): unknown[] {
  return Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
}

export async function ensureEmailStatusColumn() {
  try {
    const colCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'email_status'
      ) as exists
    `);
    const colRows = rows(colCheck);
    if (!(colRows[0] as { exists?: boolean })?.exists) {
      await db.execute(sql`ALTER TABLE orders ADD COLUMN email_status TEXT`);
      console.log("[migration] email-status: added email_status column to orders");
    }
  } catch (err) {
    console.error("[migration] email-status: error adding column:", err);
  }
}
