import { db } from "../db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "server/seed-data.json"), "utf8"));
  const seedReviews: any[] = data.productReviews;

  const prodRows = await db.execute(sql`SELECT id, slug FROM products`);
  const slugToId: Record<string,string> = Object.fromEntries(
    (((prodRows as any).rows ?? prodRows) as any[]).map((r:any) => [r.slug, r.id])
  );

  const mismatches: {product: string, reviewer: string, currentId: string, wantId: string, targetExists: boolean}[] = [];

  for (const seed of seedReviews) {
    const pid = slugToId[seed.productSlug];
    if (!pid) continue;
    const bodyEsc = (seed.body ?? "").replace(/'/g, "''");
    const nameEsc = (seed.reviewerName ?? "").replace(/'/g, "''");
    const res = await db.execute(sql.raw(`SELECT id FROM product_reviews WHERE product_id='${pid}' AND reviewer_name='${nameEsc}' AND rating=${seed.rating} AND body='${bodyEsc}' LIMIT 1`));
    const found = (((res as any).rows ?? res) as any[]);
    if (!found.length) { console.log("NO MATCH:", seed.id, seed.productSlug); continue; }
    const cur = found[0].id;
    if (cur !== seed.id) {
      const tgt = await db.execute(sql.raw(`SELECT id FROM product_reviews WHERE id='${seed.id}' LIMIT 1`));
      const tgtExists = (((tgt as any).rows ?? tgt) as any[]).length > 0;
      mismatches.push({ product: seed.productSlug, reviewer: seed.reviewerName, currentId: cur, wantId: seed.id, targetExists: tgtExists });
    }
  }

  if (mismatches.length === 0) { console.log("All reviews are correct!"); }
  else { console.log("Remaining mismatches:"); mismatches.forEach(m => console.log(JSON.stringify(m))); }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
