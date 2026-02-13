import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "../server/db";
import { products, categories, productImages } from "../shared/schema";
import { eq } from "drizzle-orm";

const EXCEL_FILE = "attached_assets/Category+Listings+Report_02-13-2026_1771001667135.xlsm";
const IMAGES_DIR = "client/public/images/products";

const COL = {
  STATUS: 0, TITLE: 1, SKU: 2, PRODUCT_TYPE: 3, ITEM_NAME: 8, BRAND: 9,
  ASIN: 11, MAIN_IMAGE: 38,
  OTHER_IMAGES_START: 39, OTHER_IMAGES_END: 46,
  DESCRIPTION: 48,
  BULLET1: 49, BULLET2: 50, BULLET3: 51, BULLET4: 52, BULLET5: 53,
  MATERIAL1: 56,
  COLOR: 69, SIZE: 70,
  PRICE: 373, MRP: 374,
  WEIGHT: 457, WEIGHT_UNIT: 458,
};

function categorizeProduct(title: string, productType: string) {
  const t = title.toLowerCase();
  if (t.includes("bathrobe") || t.includes("bath robe") || productType === "ROBE" || productType === "LEOTARD") {
    if (t.includes("couple")) return { categorySlug: "couple-bathrobes", audience: "couples", pType: "bathrobe" };
    if (t.includes("teen")) return { categorySlug: "teen-bathrobes", audience: "kids", pType: "bathrobe" };
    if (t.includes("adult") || t.includes("women") || t.includes("men's") || t.includes("men,"))
      return { categorySlug: "adult-bathrobes", audience: "adults", pType: "bathrobe" };
    return { categorySlug: "kids-bathrobes", audience: "kids", pType: "bathrobe" };
  }
  if (t.includes("blanket") || productType === "BLANKET")
    return { categorySlug: "kids-blankets", audience: "kids", pType: "blanket" };
  if (t.includes("adult") || t.includes("women") || t.includes("men's") || t.includes("men,"))
    return { categorySlug: "adult-bath-towels", audience: "adults", pType: "towel" };
  return { categorySlug: "kids-bath-towels", audience: "kids", pType: "towel" };
}

function extractGSM(title: string, description: string): number | null {
  const match = (title + " " + description).match(/(\d{3,4})\s*GSM/i);
  return match ? parseInt(match[1]) : null;
}

function generateSlug(title: string): string {
  let slug = title
    .replace(/^TurtleLittle,?\s*/i, "")
    .replace(/,?\s*100% Cotton,?\s*/i, " ")
    .replace(/,?\s*Cotton,?\s*/i, " ")
    .replace(/,?\s*Fleece,?\s*/i, " ")
    .replace(/\(Set of \d+.*?\)/gi, "")
    .replace(/\d{3,4}\s*GSM/gi, "")
    .replace(/Personalised\s*/gi, "")
    .replace(/Personalized\s*/gi, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (slug.length > 80) slug = slug.substring(0, 80).replace(/-$/, "");
  return slug || "product";
}

function parseWeight(weight: string, unit: string): number | null {
  if (!weight) return null;
  const num = parseFloat(weight.split(",")[0].trim());
  if (isNaN(num)) return null;
  const u = (unit || "").toLowerCase().split(",")[0].trim();
  if (u.includes("kilo")) return Math.round(num * 1000);
  return Math.round(num);
}

async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) return false;
    fs.writeFileSync(path.join(IMAGES_DIR, "large", filename), buffer);
    await sharp(buffer).resize(400, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(path.join(IMAGES_DIR, "medium", filename));
    await sharp(buffer).resize(150, null, { withoutEnlargement: true }).jpeg({ quality: 70 }).toFile(path.join(IMAGES_DIR, "small", filename));
    return true;
  } catch { return false; }
}

async function run() {
  console.log("Parsing Excel...");
  const wb = XLSX.readFile(EXCEL_FILE);
  const sheet = wb.Sheets["Template"];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1, raw: true });
  const dataRows = data.slice(6);

  const cats = await db.select().from(categories);
  const categoryMap = new Map(cats.map(c => [c.slug, c.id]));

  const existingProducts = await db.select().from(products);
  const existingAsins = new Set(existingProducts.filter(p => p.amazonAsin).map(p => p.amazonAsin!));
  const existingSlugs = new Set(existingProducts.map(p => p.slug));

  console.log(`Existing products: ${existingProducts.length}, ASINs: ${existingAsins.size}`);

  let created = 0, skippedExisting = 0, imgOk = 0, imgFail = 0;
  const newSlugCounts = new Map<string, number>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const title = (row[COL.TITLE] || "").toString().trim();
    const brand = (row[COL.BRAND] || "").toString().trim();
    if (!title || !brand.includes("TurtleLittle")) continue;
    const status = (row[COL.STATUS] || "").toString().trim();
    if (status && status !== "Active") continue;

    const asin = (row[COL.ASIN] || "").toString().trim();
    if (asin && existingAsins.has(asin)) { skippedExisting++; continue; }

    const sku = (row[COL.SKU] || "").toString().trim();
    const productType = (row[COL.PRODUCT_TYPE] || "").toString().trim();
    const description = (row[COL.DESCRIPTION] || "").toString().trim();
    const mainImageUrl = (row[COL.MAIN_IMAGE] || "").toString().trim();

    const bulletPoints: string[] = [];
    for (let c = COL.BULLET1; c <= COL.BULLET5; c++) {
      const bp = (row[c] || "").toString().trim();
      if (bp) bulletPoints.push(bp);
    }
    const otherImageUrls: string[] = [];
    for (let c = COL.OTHER_IMAGES_START; c <= COL.OTHER_IMAGES_END; c++) {
      const url = (row[c] || "").toString().trim();
      if (url && url.startsWith("http")) otherImageUrls.push(url);
    }

    const material = (row[COL.MATERIAL1] || "").toString().trim();
    const color = (row[COL.COLOR] || "").toString().trim();
    const dimensions = (row[COL.SIZE] || "").toString().trim();
    const price = Math.round(parseFloat((row[COL.PRICE] || "0").toString()));
    const mrp = Math.round(parseFloat((row[COL.MRP] || "0").toString()));
    const weightGrams = parseWeight((row[COL.WEIGHT] || "").toString(), (row[COL.WEIGHT_UNIT] || "").toString());
    const { categorySlug, audience, pType } = categorizeProduct(title, productType);
    const gsm = extractGSM(title, description);
    const categoryId = categoryMap.get(categorySlug);
    if (!categoryId) continue;

    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let suffix = 1;
    while (existingSlugs.has(slug) || newSlugCounts.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }
    existingSlugs.add(slug);
    newSlugCounts.set(slug, 1);

    const imageFilename = `${slug.substring(0, 60)}.jpg`;
    const mainImagePath = `/images/products/${imageFilename}`;
    let imageOk = fs.existsSync(path.join(IMAGES_DIR, "large", imageFilename));
    if (!imageOk && mainImageUrl) {
      imageOk = await downloadImage(mainImageUrl, imageFilename);
      if (imageOk) imgOk++; else imgFail++;
    }

    const [newProduct] = await db.insert(products).values({
      name: title.replace(/^TurtleLittle,?\s*/i, "").trim(),
      slug, description: description || null, price, mrp: mrp || null,
      imageUrl: imageOk ? mainImagePath : "/images/products/placeholder.jpg",
      categoryId, amazonAsin: asin || null, color: color || null,
      material: material || null, gsm: gsm || null, dimensions: dimensions || null,
      weightGrams: weightGrams || null,
      bulletPoints: bulletPoints.length > 0 ? JSON.stringify(bulletPoints) : null,
      searchKeywords: null, productType: pType, audience, active: true,
      sortOrder: existingProducts.length + created,
    }).returning();
    created++;

    for (let j = 0; j < otherImageUrls.length; j++) {
      const otherFilename = `${slug.substring(0, 55)}_${j + 1}.jpg`;
      let otherOk = fs.existsSync(path.join(IMAGES_DIR, "large", otherFilename));
      if (!otherOk) {
        otherOk = await downloadImage(otherImageUrls[j], otherFilename);
        if (otherOk) imgOk++; else imgFail++;
      }
      if (otherOk) {
        await db.insert(productImages).values({
          productId: newProduct.id, imageUrl: `/images/products/${otherFilename}`,
          sortOrder: j + 1, isPrimary: false,
        });
      }
    }

    if (created % 10 === 0) {
      console.log(`  Created: ${created} | Skipped: ${skippedExisting} | Images: ${imgOk} ok, ${imgFail} fail`);
    }
  }

  console.log("\n=== RESUME IMPORT COMPLETE ===");
  console.log(`New products created: ${created}`);
  console.log(`Skipped (already exist): ${skippedExisting}`);
  console.log(`Images: ${imgOk} downloaded, ${imgFail} failed`);

  const final = await db.select().from(products);
  console.log(`Total products in DB: ${final.length}`);
  for (const cat of cats) {
    const prods = await db.select().from(products).where(eq(products.categoryId, cat.id));
    console.log(`  ${cat.name}: ${prods.length}`);
  }
}

run().then(() => { console.log("Done!"); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
