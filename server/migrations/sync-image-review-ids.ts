import { db } from "../db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function execSql(query: string) {
  return db.execute(sql.raw(query));
}

function esc(s: string) {
  return s.replace(/'/g, "''");
}

async function syncTable(
  tableName: string,
  seedRows: any[],
  slugToId: Record<string, string>,
  matchFn: (seed: any, productId: string) => string,
  seedIdField = "id",
  seedSlugField = "productSlug",
): Promise<number> {
  // Build: seedId → currentId (what we need to rename)
  // Skip if already correct; dedup by using first match only
  const seenFromIds = new Set<string>();
  const updates: { from: string; to: string }[] = [];

  for (const seed of seedRows) {
    const productId = slugToId[seed[seedSlugField]];
    if (!productId) continue;

    const res = await execSql(
      `SELECT id FROM ${tableName} WHERE ${matchFn(seed, productId)} LIMIT 1`
    );
    const rows: any[] = Array.isArray(res) ? res : (res as any).rows ?? [];
    if (rows.length === 0) continue;

    const currentId: string = rows[0].id;
    const targetId: string = seed[seedIdField];

    if (currentId === targetId) continue;         // already correct
    if (seenFromIds.has(currentId)) continue;     // same row matched twice — skip

    // Check if target ID already exists (another row is already correct)
    const targetCheck = await execSql(
      `SELECT id FROM ${tableName} WHERE id = '${esc(targetId)}' LIMIT 1`
    );
    const targetExists = (Array.isArray(targetCheck) ? targetCheck : (targetCheck as any).rows ?? []).length > 0;
    if (targetExists) continue;                   // target already placed — skip

    seenFromIds.add(currentId);
    updates.push({ from: currentId, to: targetId });
  }

  if (updates.length === 0) return 0;

  // Pass 1: rename every `from` to a unique numeric temp ID that cannot collide
  for (let i = 0; i < updates.length; i++) {
    await execSql(
      `UPDATE ${tableName} SET id = 'mig_tmp_${i}' WHERE id = '${esc(updates[i].from)}'`
    );
  }
  // Pass 2: rename every temp ID to the correct target
  for (let i = 0; i < updates.length; i++) {
    await execSql(
      `UPDATE ${tableName} SET id = '${esc(updates[i].to)}' WHERE id = 'mig_tmp_${i}'`
    );
  }

  return updates.length;
}

export async function syncImageReviewIds() {
  try {
    const seedPath = path.join(process.cwd(), "server/seed-data.json");
    if (!fs.existsSync(seedPath)) {
      console.log("[migration] sync-image-review-ids: seed-data.json not found, skipping");
      return;
    }

    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    const seedImages: any[]  = data.productImages  || [];
    const seedReviews: any[] = data.productReviews || [];

    const prodRows = await db.execute<{ id: string; slug: string }>(sql`SELECT id, slug FROM products`);
    const rows = Array.isArray(prodRows) ? prodRows : (prodRows as any).rows ?? [];
    const slugToId: Record<string, string> = Object.fromEntries(rows.map((r: any) => [r.slug, r.id]));

    const imgFixed = await syncTable(
      "product_images",
      seedImages,
      slugToId,
      (seed, pid) =>
        `product_id = '${esc(pid)}' AND image_url = '${esc(seed.imageUrl)}' AND COALESCE(sort_order,0) = ${seed.sortOrder ?? 0}`,
    );

    const revFixed = await syncTable(
      "product_reviews",
      seedReviews,
      slugToId,
      (seed, pid) =>
        `product_id = '${esc(pid)}' AND reviewer_name = '${esc(seed.reviewerName ?? "")}' AND rating = ${seed.rating}`,
    );

    console.log(
      `[migration] sync-image-review-ids: images ${imgFixed > 0 ? `fixed ${imgFixed}` : "all correct"}, ` +
      `reviews ${revFixed > 0 ? `fixed ${revFixed}` : "all correct"}`
    );
  } catch (err: any) {
    console.error("[migration] sync-image-review-ids failed:", err.message);
  }
}
