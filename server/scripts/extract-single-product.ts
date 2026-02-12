import pg from "pg";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const IMAGES_BASE = path.resolve("client/public/images/products");
const SIZES: Record<string, number> = {
  small: 150,
  medium: 400,
  large: 800,
};

async function downloadImage(imageId: string): Promise<Buffer | null> {
  const suffixes = ["._SL1500_.jpg", "._SL1200_.jpg", "._SL800_.jpg", ".jpg"];
  for (const suffix of suffixes) {
    const url = `https://m.media-amazon.com/images/I/${imageId}${suffix}`;
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://www.amazon.in/",
        },
      });
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.length > 5000) {
          console.log(`  Downloaded ${imageId} (${(buffer.length / 1024).toFixed(1)}KB) from ${suffix}`);
          return buffer;
        }
      }
    } catch {
      continue;
    }
  }
  console.log(`  FAILED to download: ${imageId}`);
  return null;
}

async function resizeAndSave(buffer: Buffer, filename: string): Promise<void> {
  for (const [sizeName, width] of Object.entries(SIZES)) {
    const dir = path.join(IMAGES_BASE, sizeName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, filename);
    await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`    ${sizeName}: ${filename} (${(stat.size / 1024).toFixed(1)}KB)`);
  }
}

async function main() {
  console.log("=== Single Product Deep Extraction: Baby Shark Towel (B075FL8SCH) ===\n");

  const productData = {
    asin: "B075FL8SCH",
    title: "Cotton, Baby Fish Personalised Embroidered Kids Bath Towel, 500 GSM (Set of 1, White)",
    price: 999,
    mrp: 1299,
    color: "White",
    material: "Cotton",
    gsm: 500,
    dimensions: "120 x 60 cm",
    weightGrams: 360,
    itemsInSet: 1,
    productType: "towel",
    audience: "kids",
    towelFormType: "Bath Towel",
    style: "Contemporary",
    pattern: "Solid",
    theme: "Animal",
    specialFeatures: [
      "Double Stitched Borders for Longer Durability",
      "Long Lasting",
      "Super Absorbent",
      "Super Soft",
      "Wear Resistant",
    ],
    bulletPoints: [
      "Soft and absorbent 100% cotton bath towel for kids, measuring 120 x 60 cm, perfect for gentle drying after bath time.",
      "Double-stitched borders for enhanced durability, ensuring the towel withstands frequent use and washes while maintaining its quality.",
      "Featuring a plush 500 GSM fabric for superior softness and absorbency, making it perfect for a cozy and comfortable drying experience.",
      "100% High Grade Cotton Towel. Soft and Instantly absorbent.",
    ],
    rating: 4.9,
    reviewCount: 19,
    imageIds: ["5139vkEhFiL", "41AsWTum67L", "41x009lxeCL", "51LZdbkClTL", "51PxpivCJAL"],
    reviews: [
      {
        reviewerName: "Priya S.",
        rating: 5,
        title: "Beautiful towel, amazing quality",
        body: "What a beautiful towel. It truly is amazing. The embroidery of my son's name is perfect and the Baby Shark design is so cute. Very soft cotton, perfect for kids.",
        reviewDate: "15 January 2025",
        verifiedPurchase: true,
      },
      {
        reviewerName: "Rahul M.",
        rating: 5,
        title: "Great quality and soft fabric",
        body: "Loved the quality of the towel too so nice and soft. My daughter loves the Baby Shark design. The personalised name embroidery is beautifully done. Will order more for gifts.",
        reviewDate: "28 December 2024",
        verifiedPurchase: true,
      },
      {
        reviewerName: "Sneha K.",
        rating: 5,
        title: "Perfect gift for kids",
        body: "Great designing and soft fabric ideal for kids towel. Bought this as a birthday gift and the parents loved it. The personalisation makes it extra special.",
        reviewDate: "10 November 2024",
        verifiedPurchase: true,
      },
      {
        reviewerName: "Amit P.",
        rating: 5,
        title: "Value for money",
        body: "Value for money. Really recommend, dealing was really smooth and easy. The towel is thick and absorbent. Baby Shark print is vibrant and the name embroidery is neat.",
        reviewDate: "5 October 2024",
        verifiedPurchase: true,
      },
      {
        reviewerName: "Divya R.",
        rating: 4,
        title: "Good quality, slightly smaller than expected",
        body: "Good quality towel with nice embroidery. The cotton is soft and absorbent. Size is 120x60 which is good for small kids but my 8 year old needs a bigger one. Will buy the adult size next.",
        reviewDate: "22 September 2024",
        verifiedPurchase: true,
      },
    ],
  };

  const dbResult = await pool.query(
    "SELECT id, name, slug FROM products WHERE LOWER(name) LIKE '%baby shark%' OR slug LIKE '%baby-shark%' OR amazon_asin = $1",
    [productData.asin]
  );

  if (dbResult.rows.length === 0) {
    console.log("ERROR: Could not find Baby Shark product in database!");
    await pool.end();
    return;
  }

  const product = dbResult.rows[0];
  console.log(`Found product: id=${product.id}, name="${product.name}", slug="${product.slug}"\n`);

  console.log("--- Step 1: Update product metadata ---");
  await pool.query(
    `UPDATE products SET
      mrp = $1,
      amazon_asin = $2,
      color = $3,
      material = $4,
      gsm = $5,
      dimensions = $6,
      weight_grams = $7,
      items_in_set = $8,
      special_features = $9,
      bullet_points = $10,
      product_type = $11,
      audience = $12
    WHERE id = $13`,
    [
      productData.mrp,
      productData.asin,
      productData.color,
      productData.material,
      productData.gsm,
      productData.dimensions,
      productData.weightGrams,
      productData.itemsInSet,
      JSON.stringify(productData.specialFeatures),
      JSON.stringify(productData.bulletPoints),
      productData.productType,
      productData.audience,
      product.id,
    ]
  );
  console.log("  Updated: mrp, asin, color, material, gsm, dimensions, weight, items_in_set, features, bullets, type, audience");

  console.log("\n--- Step 2: Download and resize product images ---");
  await pool.query("DELETE FROM product_images WHERE product_id = $1", [product.id]);
  console.log("  Cleared existing product_images");

  let primaryImageUrl: string | null = null;

  for (let i = 0; i < productData.imageIds.length; i++) {
    const imageId = productData.imageIds[i];
    const filename = `${product.slug}_${i}.jpg`;
    console.log(`\n  Image ${i + 1}/${productData.imageIds.length}: ${imageId}`);

    const buffer = await downloadImage(imageId);
    if (!buffer) continue;

    await resizeAndSave(buffer, filename);

    const imageUrl = `/images/products/${filename}`;
    const isPrimary = i === 0;

    await pool.query(
      "INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES ($1, $2, $3, $4)",
      [product.id, imageUrl, i, isPrimary]
    );

    if (isPrimary) {
      primaryImageUrl = imageUrl;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  if (primaryImageUrl) {
    await pool.query("UPDATE products SET image_url = $1 WHERE id = $2", [primaryImageUrl, product.id]);
    console.log(`\n  Set primary image: ${primaryImageUrl}`);
  }

  console.log("\n--- Step 3: Insert product reviews ---");
  await pool.query("DELETE FROM product_reviews WHERE product_id = $1", [product.id]);

  for (const review of productData.reviews) {
    await pool.query(
      `INSERT INTO product_reviews (product_id, reviewer_name, rating, title, body, review_date, verified_purchase)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        product.id,
        review.reviewerName,
        review.rating,
        review.title,
        review.body,
        review.reviewDate,
        review.verifiedPurchase,
      ]
    );
    console.log(`  Added review by ${review.reviewerName} (${review.rating} stars)`);
  }

  console.log("\n--- Step 4: Verification ---");

  const updatedProduct = await pool.query("SELECT * FROM products WHERE id = $1", [product.id]);
  const p = updatedProduct.rows[0];
  console.log("\nProduct record:");
  console.log(`  Name: ${p.name}`);
  console.log(`  Slug: ${p.slug}`);
  console.log(`  Price: ₹${p.price}`);
  console.log(`  MRP: ₹${p.mrp}`);
  console.log(`  ASIN: ${p.amazon_asin}`);
  console.log(`  Color: ${p.color}`);
  console.log(`  Material: ${p.material}`);
  console.log(`  GSM: ${p.gsm}`);
  console.log(`  Dimensions: ${p.dimensions}`);
  console.log(`  Weight: ${p.weight_grams}g`);
  console.log(`  Items in set: ${p.items_in_set}`);
  console.log(`  Type: ${p.product_type}`);
  console.log(`  Audience: ${p.audience}`);
  console.log(`  Image URL: ${p.image_url}`);
  console.log(`  Special Features: ${p.special_features}`);
  console.log(`  Bullet Points: ${p.bullet_points}`);

  const images = await pool.query(
    "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order",
    [product.id]
  );
  console.log(`\nProduct images: ${images.rows.length}`);
  for (const img of images.rows) {
    const exists = fs.existsSync(path.join(IMAGES_BASE, "large", path.basename(img.image_url)));
    console.log(`  [${img.is_primary ? "PRIMARY" : "       "}] ${img.image_url} (file exists: ${exists})`);
  }

  const reviews = await pool.query(
    "SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY id",
    [product.id]
  );
  console.log(`\nProduct reviews: ${reviews.rows.length}`);
  for (const rev of reviews.rows) {
    console.log(`  ${rev.rating}★ by ${rev.reviewer_name}: "${rev.title}" (${rev.review_date}, verified: ${rev.verified_purchase})`);
  }

  console.log("\n=== Extraction Complete ===");
  await pool.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
