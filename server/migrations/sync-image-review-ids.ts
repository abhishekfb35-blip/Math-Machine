import { db } from "../db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function execRaw(query: string) {
  return db.execute(sql.raw(query));
}

function esc(s: string) {
  return s.replace(/'/g, "''");
}

function rows(res: unknown): any[] {
  return Array.isArray(res) ? res : (res as any).rows ?? [];
}

async function cleanupStuckRows(
  tableName: string,
  seedRows: any[],
  slugToId: Record<string, string>,
  matchFn: (seed: any, productId: string, row: any) => boolean,
  seedIdField = "id",
  seedSlugField = "productSlug",
) {
  const stuck = rows(await db.execute(sql.raw(`SELECT * FROM ${tableName} WHERE id LIKE 'mig_tmp_%'`)));
  if (stuck.length === 0) return;
  console.log(`[migration] sync-image-review-ids: rescuing ${stuck.length} stuck ${tableName} rows`);

  for (const row of stuck) {
    const seed = seedRows.find(s => {
      const pid = slugToId[s[seedSlugField]];
      return pid && matchFn(s, pid, row);
    });
    if (!seed) {
      await execRaw(`DELETE FROM ${tableName} WHERE id='${esc(row.id)}'`);
      continue;
    }
    const targetExists = rows(await execRaw(`SELECT id FROM ${tableName} WHERE id='${esc(seed[seedIdField])}' LIMIT 1`)).length > 0;
    if (targetExists) {
      await execRaw(`DELETE FROM ${tableName} WHERE id='${esc(row.id)}'`);
    } else {
      await execRaw(`UPDATE ${tableName} SET id='${esc(seed[seedIdField])}' WHERE id='${esc(row.id)}'`);
    }
  }
}

async function syncTable(
  tableName: string,
  seedRows: any[],
  slugToId: Record<string, string>,
  matchSql: (seed: any, productId: string) => string,
  seedIdField = "id",
  seedSlugField = "productSlug",
): Promise<number> {
  const allSeedIds = new Set(seedRows.map(s => s[seedIdField]));

  const seenFromIds = new Set<string>();
  const updates: { from: string; to: string }[] = [];

  for (const seed of seedRows) {
    const productId = slugToId[seed[seedSlugField]];
    if (!productId) continue;

    const found = rows(await execRaw(`SELECT id FROM ${tableName} WHERE ${matchSql(seed, productId)} LIMIT 1`));
    if (found.length === 0) continue;

    const currentId: string = found[0].id;
    const targetId: string = seed[seedIdField];

    if (currentId === targetId) continue;
    if (allSeedIds.has(currentId)) continue;
    if (seenFromIds.has(currentId)) continue;

    const targetExists = rows(await execRaw(`SELECT id FROM ${tableName} WHERE id='${esc(targetId)}' LIMIT 1`)).length > 0;
    if (targetExists) continue;

    seenFromIds.add(currentId);
    updates.push({ from: currentId, to: targetId });
  }

  if (updates.length === 0) return 0;

  for (let i = 0; i < updates.length; i++) {
    await execRaw(`UPDATE ${tableName} SET id='mig_tmp_${i}' WHERE id='${esc(updates[i].from)}'`);
  }
  for (let i = 0; i < updates.length; i++) {
    await execRaw(`UPDATE ${tableName} SET id='${esc(updates[i].to)}' WHERE id='mig_tmp_${i}'`);
  }

  return updates.length;
}

export async function syncImageReviewIds() {
  const seedPath = path.join(process.cwd(), "server/seed-data.json");
  if (!fs.existsSync(seedPath)) {
    console.log("[migration] sync-image-review-ids: seed-data.json not found, skipping");
    return;
  }

  const data = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const seedImages: any[]  = data.productImages  || [];
  const seedReviews: any[] = data.productReviews || [];

  const prodRows = rows(await db.execute(sql`SELECT id, slug FROM products`));
  const slugToId: Record<string, string> = Object.fromEntries(prodRows.map((r: any) => [r.slug, r.id]));

  await cleanupStuckRows(
    "product_images", seedImages, slugToId,
    (seed, pid, row) =>
      pid === row.product_id &&
      seed.imageUrl === row.image_url &&
      (seed.sortOrder ?? 0) === (row.sort_order ?? 0),
  );
  await cleanupStuckRows(
    "product_reviews", seedReviews, slugToId,
    (seed, pid, row) =>
      pid === row.product_id &&
      seed.reviewerName === row.reviewer_name &&
      seed.rating === row.rating &&
      seed.body === row.body,
  );

  const imgFixed = await syncTable(
    "product_images", seedImages, slugToId,
    (seed, pid) =>
      `product_id='${esc(pid)}' AND image_url='${esc(seed.imageUrl)}' AND COALESCE(sort_order,0)=${seed.sortOrder ?? 0}`,
  );

  const revFixed = await syncTable(
    "product_reviews", seedReviews, slugToId,
    (seed, pid) =>
      `product_id='${esc(pid)}' AND reviewer_name='${esc(seed.reviewerName ?? "")}' AND rating=${seed.rating} AND body='${esc(seed.body ?? "")}'`,
  );

  console.log(
    `[migration] sync-image-review-ids: images ${imgFixed > 0 ? `fixed ${imgFixed}` : "all correct"}, ` +
    `reviews ${revFixed > 0 ? `fixed ${revFixed}` : "all correct"}`
  );
}
