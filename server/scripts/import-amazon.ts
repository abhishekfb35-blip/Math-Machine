import pg from "pg";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AmazonProduct {
  asin: string;
  amazonUrl: string;
  matchSlug: string | null;
  matchName: string;
  title: string;
  price: number;
  mrp: number;
  color: string;
  material: string;
  gsm: number | null;
  dimensions: string;
  weightGrams: number | null;
  itemsInSet: number;
  specialFeatures: string[];
  bulletPoints: string[];
  imageIds: string[];
  rating: number;
  reviewCount: number;
  productType: string;
  audience: string;
  category: string;
}

interface DbProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  category_id: number;
  image_url: string;
}

const IMAGES_BASE = path.resolve("client/public/images/products");
const SIZES = {
  small: 150,
  medium: 400,
  large: 800,
};

async function fetchAmazonPage(url: string): Promise<string> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  }
  return await resp.text();
}

function extractImageIds(html: string): string[] {
  const ids = new Set<string>();

  const patterns = [
    /https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9+\-_]+)\./g,
    /https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/([A-Za-z0-9+\-_]+)\./g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const id = match[1];
      if (
        !id.startsWith("0") &&
        id.length > 8 &&
        !id.includes("sprite") &&
        !id.includes("nav-") &&
        !id.includes("icon") &&
        !id.includes("logo") &&
        !id.includes("loading") &&
        !id.includes("transparent") &&
        !id.includes("sash")
      ) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

function extractReviews(html: string): Array<{
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  reviewDate: string;
  verifiedPurchase: boolean;
}> {
  const reviews: Array<{
    reviewerName: string;
    rating: number;
    title: string;
    body: string;
    reviewDate: string;
    verifiedPurchase: boolean;
  }> = [];

  const reviewBlockRegex =
    /<div[^>]*data-hook="review"[^>]*>([\s\S]*?)(?=<div[^>]*data-hook="review"|$)/g;
  let blockMatch;

  while ((blockMatch = reviewBlockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    const nameMatch = block.match(
      /class="a-profile-name"[^>]*>([^<]+)</
    );
    const ratingMatch = block.match(
      /(\d(?:\.\d)?)\s*out of\s*5\s*stars/
    );
    const titleMatch = block.match(
      /data-hook="review-title"[^>]*>(?:[\s\S]*?<span[^>]*>)*([^<]+)</
    );
    const bodyMatch = block.match(
      /data-hook="review-body"[^>]*>[\s\S]*?<span[^>]*>([^<]+)</
    );
    const dateMatch = block.match(
      /data-hook="review-date"[^>]*>[^<]*on\s+([^<]+)</
    );
    const verifiedMatch = block.match(/Verified Purchase/i);

    if (nameMatch && bodyMatch) {
      reviews.push({
        reviewerName: nameMatch[1].trim(),
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : 5,
        title: titleMatch ? titleMatch[1].trim() : "",
        body: bodyMatch[1].trim(),
        reviewDate: dateMatch ? dateMatch[1].trim() : "",
        verifiedPurchase: !!verifiedMatch,
      });
    }
  }

  return reviews;
}

async function downloadImage(
  imageId: string,
  filename: string
): Promise<Buffer | null> {
  const urls = [
    `https://m.media-amazon.com/images/I/${imageId}._SL1500_.jpg`,
    `https://m.media-amazon.com/images/I/${imageId}._SL1200_.jpg`,
    `https://m.media-amazon.com/images/I/${imageId}._SL800_.jpg`,
    `https://m.media-amazon.com/images/I/${imageId}.jpg`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.length > 5000) {
          return buffer;
        }
      }
    } catch {
      continue;
    }
  }

  console.log(`  [WARN] Could not download image ${imageId}`);
  return null;
}

async function resizeAndSave(
  buffer: Buffer,
  filename: string
): Promise<void> {
  for (const [sizeName, width] of Object.entries(SIZES)) {
    const dir = path.join(IMAGES_BASE, sizeName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const outPath = path.join(dir, filename);
    await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outPath);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

async function findMatchingProduct(
  product: AmazonProduct,
  dbProducts: DbProduct[]
): Promise<DbProduct | null> {
  if (product.matchSlug) {
    const match = dbProducts.find((p) => p.slug === product.matchSlug);
    if (match) return match;
  }

  const searchTerms = product.matchName.toLowerCase().split(/\s+/);
  const candidates = dbProducts.filter((p) => {
    const name = p.name.toLowerCase();
    return searchTerms.every((term) => name.includes(term));
  });

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const priceMatch = candidates.find((c) => c.price === product.price);
    if (priceMatch) return priceMatch;
    return candidates[0];
  }

  return null;
}

async function getCategoryId(
  categoryName: string
): Promise<number | null> {
  const slugMap: Record<string, string> = {
    "Girls Towels": "girls-towels",
    "Boys Towels": "boys-towels",
    "Couple Towels": "couple-towels",
    "Boys Blankets": "boys-blankets",
    "Girls Blankets": "girls-blankets",
    Bathrobes: "bathrobes",
  };

  const slug = slugMap[categoryName];
  if (!slug) return null;

  const result = await pool.query(
    "SELECT id FROM categories WHERE slug = $1",
    [slug]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const insertResult = await pool.query(
    "INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3) RETURNING id",
    [categoryName, slug, 10]
  );
  return insertResult.rows[0].id;
}

async function main() {
  console.log("=== TurtleLittle Amazon Import ===\n");

  const dataPath = path.resolve("server/scripts/amazon-product-data.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const amazonProducts: AmazonProduct[] = data.products;

  console.log(`Loaded ${amazonProducts.length} Amazon products\n`);

  const dbResult = await pool.query(
    "SELECT id, name, slug, price, category_id, image_url FROM products ORDER BY id"
  );
  const dbProducts: DbProduct[] = dbResult.rows;
  console.log(`Found ${dbProducts.length} existing DB products\n`);

  let updated = 0;
  let created = 0;
  let imagesDownloaded = 0;

  for (const amzProduct of amazonProducts) {
    console.log(`\n--- Processing: ${amzProduct.asin} (${amzProduct.matchName}) ---`);

    let imageIds = amzProduct.imageIds;

    if (imageIds.length === 0) {
      console.log("  Fetching Amazon page for image IDs...");
      try {
        const html = await fetchAmazonPage(amzProduct.amazonUrl);
        imageIds = extractImageIds(html);
        console.log(`  Found ${imageIds.length} image IDs from page`);

        const reviews = extractReviews(html);
        if (reviews.length > 0) {
          console.log(`  Found ${reviews.length} reviews`);
        }
      } catch (err: any) {
        console.log(`  [WARN] Could not fetch page: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    const existingProduct = await findMatchingProduct(amzProduct, dbProducts);

    let productId: number;
    let productSlug: string;

    if (existingProduct) {
      console.log(`  Matched to existing: ${existingProduct.name} (id: ${existingProduct.id})`);
      productId = existingProduct.id;
      productSlug = existingProduct.slug;

      await pool.query(
        `UPDATE products SET 
          mrp = $1, amazon_asin = $2, color = $3, material = $4, gsm = $5,
          dimensions = $6, weight_grams = $7, items_in_set = $8,
          special_features = $9, bullet_points = $10,
          product_type = $11, audience = $12
        WHERE id = $13`,
        [
          amzProduct.mrp,
          amzProduct.asin,
          amzProduct.color,
          amzProduct.material,
          amzProduct.gsm,
          amzProduct.dimensions,
          amzProduct.weightGrams,
          amzProduct.itemsInSet,
          JSON.stringify(amzProduct.specialFeatures),
          JSON.stringify(amzProduct.bulletPoints),
          amzProduct.productType,
          amzProduct.audience,
          productId,
        ]
      );
      updated++;
    } else {
      console.log("  No match found, creating new product...");
      const categoryId = await getCategoryId(amzProduct.category);
      if (!categoryId) {
        console.log(`  [SKIP] Category not found: ${amzProduct.category}`);
        continue;
      }

      productSlug = slugify(amzProduct.title.replace(/TurtleLittle,?\s*/i, ""));
      const existingSlug = await pool.query(
        "SELECT id FROM products WHERE slug = $1",
        [productSlug]
      );
      if (existingSlug.rows.length > 0) {
        productSlug = productSlug + "-" + amzProduct.asin.toLowerCase();
      }

      const result = await pool.query(
        `INSERT INTO products (name, slug, description, price, mrp, image_url, category_id,
          amazon_asin, color, material, gsm, dimensions, weight_grams, items_in_set,
          special_features, bullet_points, product_type, audience, active, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id`,
        [
          amzProduct.title.replace(/TurtleLittle,?\s*/i, "").trim(),
          productSlug,
          amzProduct.bulletPoints.join(" "),
          amzProduct.price,
          amzProduct.mrp,
          "/images/products/placeholder.jpg",
          categoryId,
          amzProduct.asin,
          amzProduct.color,
          amzProduct.material,
          amzProduct.gsm,
          amzProduct.dimensions,
          amzProduct.weightGrams,
          amzProduct.itemsInSet,
          JSON.stringify(amzProduct.specialFeatures),
          JSON.stringify(amzProduct.bulletPoints),
          amzProduct.productType,
          amzProduct.audience,
          true,
          100,
        ]
      );
      productId = result.rows[0].id;
      created++;
    }

    if (imageIds.length > 0) {
      console.log(`  Downloading ${imageIds.length} images...`);
      let imgIndex = 0;
      for (const imageId of imageIds.slice(0, 6)) {
        const filename = `${productSlug}_${imgIndex}.jpg`;
        const buffer = await downloadImage(imageId, filename);

        if (buffer) {
          await resizeAndSave(buffer, filename);
          const imageUrl = `/images/products/${filename}`;

          await pool.query(
            `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
            VALUES ($1, $2, $3, $4)`,
            [productId, imageUrl, imgIndex, imgIndex === 0]
          );

          if (imgIndex === 0) {
            await pool.query(
              "UPDATE products SET image_url = $1 WHERE id = $2",
              [`/images/products/${filename}`, productId]
            );
          }

          imagesDownloaded++;
          imgIndex++;
          console.log(`    Saved: ${filename}`);
        }

        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`Updated: ${updated} products`);
  console.log(`Created: ${created} new products`);
  console.log(`Images downloaded: ${imagesDownloaded}`);

  await updateNonAmazonProducts();

  await pool.end();
}

async function updateNonAmazonProducts() {
  console.log("\n--- Updating non-Amazon products with default specs ---");

  const categories = await pool.query("SELECT id, name, slug FROM categories");
  const catMap: Record<number, { name: string; slug: string }> = {};
  for (const cat of categories.rows) {
    catMap[cat.id] = { name: cat.name, slug: cat.slug };
  }

  const products = await pool.query(
    "SELECT id, name, slug, price, category_id FROM products WHERE amazon_asin IS NULL"
  );

  for (const p of products.rows) {
    const cat = catMap[p.category_id];
    if (!cat) continue;

    let productType = "towel";
    let audience = "kids";
    let gsm = 500;
    let material = "Cotton";
    let dimensions = "120 x 60 cm";
    let weightGrams = 360;
    let itemsInSet = 1;
    let mrp = Math.round(p.price * 1.45);

    if (cat.slug?.includes("blanket")) {
      productType = "blanket";
      material = "Fleece";
      gsm = null as any;
      dimensions = "132 x 101 cm";
      weightGrams = null as any;
      mrp = Math.round(p.price * 1.2);
    } else if (cat.slug?.includes("bathrobe")) {
      productType = "bathrobe";
      gsm = 350;
      dimensions = "Free Size";
      weightGrams = null as any;
      mrp = Math.round(p.price * 1.15);
    } else if (cat.slug?.includes("couple")) {
      audience = "couples";
      gsm = 600;
      dimensions = "150 x 75 cm";
      weightGrams = 675;
      itemsInSet = 2;
    }

    if (cat.slug?.includes("girl")) audience = "kids";
    else if (cat.slug?.includes("boy")) audience = "kids";

    const specialFeatures =
      productType === "towel"
        ? ["Breathable", "Long Lasting", "Super Absorbent", "Super Soft", "Wear Resistant"]
        : productType === "blanket"
          ? ["Soft", "Warm", "Lightweight", "Machine Washable"]
          : ["Breathable", "Soft", "Absorbent", "Premium Quality"];

    const bulletPoints = [
      `${material === "Cotton" ? "100% High Grade Cotton" : "Premium Fleece"} ${productType}, ${gsm ? gsm + " GSM" : "premium quality"}.`,
      "Purely embroidered design, no patchwork.",
      "Personalised with child's name embroidered beautifully.",
      productType === "towel"
        ? "Double-stitched borders for enhanced durability."
        : productType === "blanket"
          ? "Perfect for AC rooms and travel."
          : "Comfortable and luxurious feel.",
    ];

    await pool.query(
      `UPDATE products SET
        mrp = COALESCE(mrp, $1),
        product_type = COALESCE(product_type, $2),
        audience = COALESCE(audience, $3),
        gsm = COALESCE(gsm, $4),
        material = COALESCE(material, $5),
        dimensions = COALESCE(dimensions, $6),
        weight_grams = COALESCE(weight_grams, $7),
        items_in_set = COALESCE(items_in_set, $8),
        special_features = COALESCE(special_features, $9),
        bullet_points = COALESCE(bullet_points, $10)
      WHERE id = $11`,
      [
        mrp,
        productType,
        audience,
        gsm,
        material,
        dimensions,
        weightGrams,
        itemsInSet,
        JSON.stringify(specialFeatures),
        JSON.stringify(bulletPoints),
        p.id,
      ]
    );
  }

  console.log(`  Updated ${products.rows.length} non-Amazon products with defaults`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
