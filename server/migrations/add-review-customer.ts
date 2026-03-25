import { db } from "../db";
import { sql } from "drizzle-orm";

type ColumnRow = { column_name: string };
type ConstraintRow = { constraint_name: string };
type IndexRow = { indexname: string };

export async function ensureReviewCustomerColumn() {
  try {
    const colResult = await db.execute<ColumnRow>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_reviews' AND column_name = 'customer_id'
    `);
    const colRows: ColumnRow[] = Array.isArray(colResult) ? colResult : (colResult as { rows: ColumnRow[] }).rows ?? [];

    if (colRows.length === 0) {
      await db.execute(sql`ALTER TABLE product_reviews ADD COLUMN customer_id TEXT`);
      console.log("[migration] add-review-customer: added customer_id column");
    }

    const fkResult = await db.execute<ConstraintRow>(sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'product_reviews'
        AND constraint_name = 'product_reviews_customer_id_fkey'
    `);
    const fkRows: ConstraintRow[] = Array.isArray(fkResult) ? fkResult : (fkResult as { rows: ConstraintRow[] }).rows ?? [];
    if (fkRows.length === 0) {
      await db.execute(sql`
        ALTER TABLE product_reviews
          ADD CONSTRAINT product_reviews_customer_id_fkey
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      `);
      console.log("[migration] add-review-customer: added foreign key constraint");
    }

    const idxResult = await db.execute<IndexRow>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'product_reviews'
        AND indexname = 'product_reviews_product_customer_uniq'
    `);
    const idxRows: IndexRow[] = Array.isArray(idxResult) ? idxResult : (idxResult as { rows: IndexRow[] }).rows ?? [];
    if (idxRows.length === 0) {
      await db.execute(sql`
        CREATE UNIQUE INDEX product_reviews_product_customer_uniq
        ON product_reviews (product_id, customer_id)
      `);
      console.log("[migration] add-review-customer: created unique index");
    }

    console.log("[migration] add-review-customer: complete");
  } catch (err: unknown) {
    console.error("[migration] add-review-customer failed:", err instanceof Error ? err.message : String(err));
  }
}
