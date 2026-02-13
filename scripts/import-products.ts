import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "../server/db";
import { products, categories, productImages, productReviews } from "../shared/schema";
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

interface ParsedProduct {
  title: string;
  sku: string;
  asin: string;
  productType: string;
  description: string;
  bulletPoints: string[];
  material: string;
  color: string;
  dimensions: string;
  price: number;
  mrp: number;
  weightGrams: number | null;
  mainImageUrl: string;
  otherImageUrls: string[];
  categorySlug: string;
  audience: string;
  gsm: number | null;
}

function categorizeProduct(title: string, productType: string): { categorySlug: string; audience: string; pType: string } {
  const t = title.toLowerCase();

  if (t.includes("bathrobe") || t.includes("bath robe") || productType === "ROBE" || productType === "LEOTARD") {
    if (t.includes("couple")) return { categorySlug: "couple-bathrobes", audience: "couples", pType: "bathrobe" };
    if (t.includes("teen")) return { categorySlug: "teen-bathrobes", audience: "kids", pType: "bathrobe" };
    if (t.includes("adult") || t.includes("women") || t.includes("men's") || t.includes("men,")) {
      return { categorySlug: "adult-bathrobes", audience: "adults", pType: "bathrobe" };
    }
    return { categorySlug: "kids-bathrobes", audience: "kids", pType: "bathrobe" };
  }

  if (t.includes("blanket") || productType === "BLANKET") {
    return { categorySlug: "kids-blankets", audience: "kids", pType: "blanket" };
  }

  if (t.includes("adult") || t.includes("women") || t.includes("men's") || t.includes("men,")) {
    return { categorySlug: "adult-bath-towels", audience: "adults", pType: "towel" };
  }

  return { categorySlug: "kids-bath-towels", audience: "kids", pType: "towel" };
}

function extractGSM(title: string, description: string): number | null {
  const combined = title + " " + description;
  const match = combined.match(/(\d{3,4})\s*GSM/i);
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
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length > 80) slug = slug.substring(0, 80).replace(/-$/, "");
  return slug;
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

    const largePath = path.join(IMAGES_DIR, "large", filename);
    fs.writeFileSync(largePath, buffer);

    const mediumPath = path.join(IMAGES_DIR, "medium", filename);
    await sharp(buffer).resize(400, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(mediumPath);

    const smallPath = path.join(IMAGES_DIR, "small", filename);
    await sharp(buffer).resize(150, null, { withoutEnlargement: true }).jpeg({ quality: 70 }).toFile(smallPath);

    return true;
  } catch (e) {
    return false;
  }
}

function parseExcel(): ParsedProduct[] {
  const wb = XLSX.readFile(EXCEL_FILE);
  const sheet = wb.Sheets["Template"];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1, raw: true });

  const dataRows = data.slice(6);
  const parsed: ParsedProduct[] = [];

  for (const row of dataRows) {
    const title = (row[COL.TITLE] || "").toString().trim();
    const brand = (row[COL.BRAND] || "").toString().trim();
    if (!title || (!brand.includes("TurtleLittle") && !title.toLowerCase().includes("turtlelittle"))) continue;

    const status = (row[COL.STATUS] || "").toString().trim();
    if (status && status !== "Active") continue;

    const asin = (row[COL.ASIN] || "").toString().trim();
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

    const priceRaw = parseFloat((row[COL.PRICE] || "0").toString());
    const mrpRaw = parseFloat((row[COL.MRP] || "0").toString());
    const price = Math.round(priceRaw);
    const mrp = Math.round(mrpRaw);

    const weightStr = (row[COL.WEIGHT] || "").toString();
    const weightUnit = (row[COL.WEIGHT_UNIT] || "").toString();
    const weightGrams = parseWeight(weightStr, weightUnit);

    const { categorySlug, audience, pType } = categorizeProduct(title, productType);
    const gsm = extractGSM(title, description);

    parsed.push({
      title, sku, asin, productType: pType, description, bulletPoints,
      material, color, dimensions, price, mrp, weightGrams,
      mainImageUrl, otherImageUrls, categorySlug, audience, gsm,
    });
  }

  return parsed;
}

async function importProducts() {
  console.log("Parsing Excel file...");
  const parsed = parseExcel();
  console.log(`Parsed ${parsed.length} products from Excel`);

  const cats = await db.select().from(categories);
  const categoryMap = new Map(cats.map(c => [c.slug, c.id]));
  console.log("Categories:", [...categoryMap.entries()].map(([k, v]) => `${k}=${v}`).join(", "));

  const existingProducts = await db.select().from(products);
  const existingBySlug = new Map(existingProducts.map(p => [p.slug, p]));
  const existingByAsin = new Map(existingProducts.filter(p => p.amazonAsin).map(p => [p.amazonAsin!, p]));

  for (const dir of ["large", "medium", "small"]) {
    const dirPath = path.join(IMAGES_DIR, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }

  let created = 0, updated = 0, skipped = 0, imageDownloads = 0, imageFails = 0;
  const slugCounts = new Map<string, number>();

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.log(`  SKIP: No category for slug "${p.categorySlug}" — ${p.title.substring(0, 60)}`);
      skipped++;
      continue;
    }

    let baseSlug = generateSlug(p.title);
    if (!baseSlug) baseSlug = "product";

    let slug = baseSlug;
    const count = slugCounts.get(baseSlug) || 0;
    if (count > 0 || existingBySlug.has(slug)) {
      let suffix = count + 1;
      while (existingBySlug.has(`${baseSlug}-${suffix}`) || slugCounts.has(`${baseSlug}-${suffix}`)) suffix++;
      slug = `${baseSlug}-${suffix}`;
    }
    slugCounts.set(baseSlug, (slugCounts.get(baseSlug) || 0) + 1);

    let existing = existingByAsin.get(p.asin) || null;

    const imageFilename = `${slug.substring(0, 60)}.jpg`;
    const mainImagePath = `/images/products/${imageFilename}`;

    let imageOk = fs.existsSync(path.join(IMAGES_DIR, "large", imageFilename));
    if (!imageOk && p.mainImageUrl) {
      imageOk = await downloadImage(p.mainImageUrl, imageFilename);
      if (imageOk) imageDownloads++;
      else imageFails++;
    }

    const productData = {
      name: p.title.replace(/^TurtleLittle,?\s*/i, "").trim(),
      slug,
      description: p.description || null,
      price: p.price,
      mrp: p.mrp || null,
      imageUrl: imageOk ? mainImagePath : (existing?.imageUrl || "/images/products/placeholder.jpg"),
      categoryId,
      amazonAsin: p.asin || null,
      color: p.color || null,
      material: p.material || null,
      gsm: p.gsm || null,
      dimensions: p.dimensions || null,
      weightGrams: p.weightGrams || null,
      bulletPoints: p.bulletPoints.length > 0 ? JSON.stringify(p.bulletPoints) : null,
      searchKeywords: null as string | null,
      productType: p.productType,
      audience: p.audience,
      active: true,
      sortOrder: i,
    };

    if (existing) {
      await db.update(products).set(productData).where(eq(products.id, existing.id));
      updated++;

      for (let j = 0; j < p.otherImageUrls.length; j++) {
        const otherFilename = `${slug.substring(0, 55)}_${j + 1}.jpg`;
        const otherOk = fs.existsSync(path.join(IMAGES_DIR, "large", otherFilename));
        if (!otherOk) {
          const downloaded = await downloadImage(p.otherImageUrls[j], otherFilename);
          if (downloaded) {
            imageDownloads++;
            await db.insert(productImages).values({
              productId: existing.id,
              imageUrl: `/images/products/${otherFilename}`,
              sortOrder: j + 1,
              isPrimary: false,
            });
          } else imageFails++;
        }
      }
    } else {
      const [newProduct] = await db.insert(products).values(productData).returning();
      created++;

      for (let j = 0; j < p.otherImageUrls.length; j++) {
        const otherFilename = `${slug.substring(0, 55)}_${j + 1}.jpg`;
        let otherOk = fs.existsSync(path.join(IMAGES_DIR, "large", otherFilename));
        if (!otherOk) {
          otherOk = await downloadImage(p.otherImageUrls[j], otherFilename);
          if (otherOk) imageDownloads++;
          else imageFails++;
        }
        if (otherOk) {
          await db.insert(productImages).values({
            productId: newProduct.id,
            imageUrl: `/images/products/${otherFilename}`,
            sortOrder: j + 1,
            isPrimary: false,
          });
        }
      }
    }

    if ((i + 1) % 20 === 0) {
      console.log(`  Progress: ${i + 1}/${parsed.length} | Created: ${created} | Updated: ${updated} | Images: ${imageDownloads} downloaded, ${imageFails} failed`);
    }
  }

  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`Products created: ${created}`);
  console.log(`Products updated: ${updated}`);
  console.log(`Products skipped: ${skipped}`);
  console.log(`Images downloaded: ${imageDownloads}`);
  console.log(`Image failures: ${imageFails}`);

  const finalCount = await db.select().from(products);
  console.log(`Total products in database: ${finalCount.length}`);

  const catCounts = await db.select().from(categories);
  for (const cat of catCounts) {
    const prods = await db.select().from(products).where(eq(products.categoryId, cat.id));
    console.log(`  ${cat.name}: ${prods.length} products`);
  }
}

importProducts().then(() => {
  console.log("Done!");
  process.exit(0);
}).catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
