import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

function unwrapViewSource(raw: string): string {
  const lines: string[] = [];
  const lineContentRe = /<td class="line-content">([\s\S]*?)<\/td>/g;
  let m;
  while ((m = lineContentRe.exec(raw)) !== null) {
    let line = m[1].replace(/<[^>]+>/g, "");
    lines.push(decodeHtmlEntities(line));
  }
  return lines.length > 0 ? lines.join("\n") : decodeHtmlEntities(raw);
}

function extractReviews(html: string) {
  const reviews: Array<{
    reviewerName: string;
    rating: number;
    title: string;
    body: string;
    verifiedPurchase: boolean;
    reviewDate: string | null;
  }> = [];

  const sections = html.split(/id="customer_review-[A-Z0-9]+"/);

  for (let i = 1; i < sections.length; i++) {
    const s = sections[i];

    const nameMatch = s.match(/a-profile-name[^>]*>([^<]{2,40})/);
    if (!nameMatch) continue;
    const reviewerName = nameMatch[1].trim();

    const ratingMatch = s.match(/(\d\.?\d?)\s*out of\s*5/);
    const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 5;

    let title = "";
    const titlePatterns = [
      /review-title-content[^>]*>[\s\S]*?<\/i>\s*<span[^>]*>([^<]{2,})<\/span>/,
      /review-title-content[^>]*>[\s\S]*?<span>([^<]{2,})<\/span>/,
      /review-title[\s\S]*?<\/i>\s*<span[^>]*>([^<]{2,})<\/span>/,
      /review-title[\s\S]*?<\/i>\s*<span>([^<]{2,})<\/span>/,
    ];
    for (const p of titlePatterns) {
      const tm = s.match(p);
      if (tm && !tm[1].includes("out of 5")) { title = tm[1].trim(); break; }
    }

    let body = "";
    const bodyPatterns = [
      /review-text-content[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
      /review-text-content[^>]*>[\s\S]*?<span[^>]*>\s*([\s\S]*?)\s*<\/span>/,
      /review-body[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
    ];
    for (const p of bodyPatterns) {
      const bm = s.match(p);
      if (bm && bm[1].trim().length > 5) {
        body = bm[1].replace(/<[^>]+>/g, "").trim();
        break;
      }
    }
    if (body.length < 5) continue;

    let reviewDate: string | null = null;
    const dateMatch = s.match(/Reviewed in India on\s+(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) reviewDate = dateMatch[1];

    const verifiedPurchase = s.includes("Verified Purchase");

    reviews.push({
      reviewerName,
      rating,
      title: title.substring(0, 200),
      body: body.substring(0, 2000),
      verifiedPurchase,
      reviewDate,
    });
  }

  return reviews;
}

async function run() {
  const asin = process.argv[2];
  if (!asin) {
    console.error("Usage: tsx scripts/import-html-reviews.ts <ASIN> [file1.html] [file2.html] ...");
    process.exit(1);
  }

  const files = process.argv.slice(3);
  if (files.length === 0) {
    console.error("No HTML files specified");
    process.exit(1);
  }

  const [product] = await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.amazonAsin, asin))
    .limit(1);

  if (!product) {
    console.error(`No product found with ASIN ${asin}`);
    process.exit(1);
  }

  console.log(`Product: ${product.name}`);
  console.log(`Product ID: ${product.id}`);

  const existingReviews = await db.select({ reviewerName: productReviews.reviewerName })
    .from(productReviews)
    .where(eq(productReviews.productId, product.id));
  const existingNames = new Set(existingReviews.map(r => r.reviewerName.toLowerCase()));
  console.log(`Existing reviews: ${existingReviews.length}`);

  let allReviews: typeof extractReviews extends (...args: any) => infer R ? R : never = [];

  for (const file of files) {
    console.log(`\nParsing: ${file}`);
    const raw = fs.readFileSync(file, "utf-8");
    const html = unwrapViewSource(raw);
    const reviews = extractReviews(html);
    console.log(`  Found ${reviews.length} reviews`);
    reviews.forEach(r => console.log(`    - ${r.reviewerName} (${r.rating}*): ${r.title || r.body.substring(0, 40)}`));
    allReviews = allReviews.concat(reviews);
  }

  const newReviews = allReviews.filter(r => !existingNames.has(r.reviewerName.toLowerCase()));
  console.log(`\nNew reviews to import: ${newReviews.length} (skipping ${allReviews.length - newReviews.length} duplicates)`);

  let imported = 0;
  for (const r of newReviews) {
    await db.insert(productReviews).values({
      productId: product.id,
      reviewerName: r.reviewerName,
      rating: r.rating,
      title: r.title || null,
      body: r.body,
      amzReviewDate: r.reviewDate,
      verifiedPurchase: r.verifiedPurchase,
    });
    imported++;
    console.log(`  Imported: ${r.reviewerName} (${r.rating}*)`);
  }

  console.log(`\nDone! Imported ${imported} new reviews for ${product.name}`);
  const totalCount = await db.select({ reviewerName: productReviews.reviewerName })
    .from(productReviews)
    .where(eq(productReviews.productId, product.id));
  console.log(`Total reviews for this product: ${totalCount.length}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
