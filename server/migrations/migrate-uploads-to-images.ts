import path from "path";
import fs from "fs";
import { pool } from "../db";

const PRODUCT_IMAGES_DIR = path.join(process.cwd(), "client", "public", "images", "products");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const RESIZE_SIZES: Record<string, number> = {
  small: 150,
  medium: 400,
  large: 800,
};

async function resizeAndSave(buffer: Buffer, filename: string): Promise<void> {
  const sharp = (await import("sharp")).default;
  for (const [sizeName, width] of Object.entries(RESIZE_SIZES)) {
    const dir = path.join(PRODUCT_IMAGES_DIR, sizeName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, filename);
    await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outPath);
  }
}

async function migrateUrl(
  oldUrl: string,
  srcPath: string,
): Promise<{ newUrl: string; copied: boolean }> {
  const oldFilename = oldUrl.replace("/uploads/", "");
  const ext = path.extname(oldFilename).toLowerCase() || ".jpg";
  const newFilename = oldFilename.endsWith(ext) ? oldFilename : `${oldFilename}${ext}`;
  const destPath = path.join(PRODUCT_IMAGES_DIR, newFilename);
  const newUrl = `/images/products/${newFilename}`;

  if (!fs.existsSync(srcPath)) {
    return { newUrl, copied: false };
  }

  const buffer = await fs.promises.readFile(srcPath);
  if (!fs.existsSync(destPath)) {
    await fs.promises.writeFile(destPath, buffer);
  }
  try {
    await resizeAndSave(buffer, newFilename);
  } catch (resizeErr) {
    console.warn(`[migrate-uploads] Resize failed for ${newFilename}:`, resizeErr);
  }
  return { newUrl, copied: true };
}

export async function migrateUploadsToImages(): Promise<void> {
  if (!fs.existsSync(PRODUCT_IMAGES_DIR)) {
    fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
  }

  const { rows: imgRows } = await pool.query<{ id: string; image_url: string }>(
    `SELECT id, image_url FROM product_images WHERE image_url LIKE '/uploads/%'`
  );

  const { rows: prodRows } = await pool.query<{ id: string; image_url: string }>(
    `SELECT id, image_url FROM products WHERE image_url LIKE '/uploads/%'`
  );

  const total = imgRows.length + prodRows.length;
  if (total === 0) return;

  console.log(`[migrate-uploads] Found ${imgRows.length} product_images + ${prodRows.length} products to migrate`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of imgRows) {
    const srcPath = path.join(UPLOADS_DIR, row.image_url.replace("/uploads/", ""));
    try {
      const { newUrl, copied } = await migrateUrl(row.image_url, srcPath);
      if (!copied) {
        console.warn(`[migrate-uploads] Source file missing, skipping DB update: ${row.image_url}`);
        skipped++;
        continue;
      }
      await pool.query(`UPDATE product_images SET image_url = $1 WHERE id = $2`, [newUrl, row.id]);
      migrated++;
    } catch (err) {
      console.error(`[migrate-uploads] Failed: ${row.image_url}`, err);
      failed++;
    }
  }

  for (const row of prodRows) {
    const srcPath = path.join(UPLOADS_DIR, row.image_url.replace("/uploads/", ""));
    try {
      const { newUrl, copied } = await migrateUrl(row.image_url, srcPath);
      if (!copied) {
        console.warn(`[migrate-uploads] Source file missing, skipping DB update: ${row.image_url}`);
        skipped++;
        continue;
      }
      await pool.query(`UPDATE products SET image_url = $1 WHERE id = $2`, [newUrl, row.id]);
      migrated++;
    } catch (err) {
      console.error(`[migrate-uploads] Failed: ${row.image_url}`, err);
      failed++;
    }
  }

  console.log(`[migrate-uploads] Done — migrated: ${migrated}, missing source: ${skipped}, failed: ${failed}`);
}
