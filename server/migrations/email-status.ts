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
      await db.execute(sql`ALTER TABLE orders ADD COLUMN email_status JSONB`);
      console.log("[migration] email-status: added email_status JSONB column to orders");
    } else {
      const typeCheck = await db.execute<{ data_type: string }>(sql`
        SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'email_status'
      `);
      const typeRows = rows(typeCheck);
      const currentType = (typeRows[0] as { data_type?: string })?.data_type;
      if (currentType === 'text') {
        await db.execute(sql`ALTER TABLE orders ALTER COLUMN email_status TYPE JSONB USING email_status::jsonb`);
        console.log("[migration] email-status: converted email_status from TEXT to JSONB");
      }
    }
  } catch (err) {
    console.error("[migration] email-status: error:", err);
    throw err;
  }
}
