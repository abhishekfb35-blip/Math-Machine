import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";

const DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<{ html: string | null; status: number }> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    if (resp.status === 404) return { html: null, status: 404 };
    if (!resp.ok) return { html: null, status: resp.status };
    const text = await resp.text();
    if (text.includes("Robot Check") || text.includes("CAPTCHA") || text.length < 5000) {
      return { html: null, status: 429 };
    }
    return { html: text, status: 200 };
  } catch { return { html: null, status: 0 }; }
}

function extractReviews(html: string): Array<{
  reviewerName: string; rating: number; title: string; body: string; verifiedPurchase: boolean;
}> {
  const reviews: Array<{
    reviewerName: string; rating: number; title: string; body: string; verifiedPurchase: boolean;
  }> = [];

  const reviewSections = html.split(/id="customer_review-[A-Z0-9]+"/);

  for (let i = 1; i < reviewSections.length && reviews.length < 8; i++) {
    const section = reviewSections[i];

    const nameMatch = section.match(/a-profile-name[^>]*>([^<]{2,40})</);
    if (!nameMatch) continue;
    const reviewerName = nameMatch[1].trim();

    const ratingMatch = section.match(/(\d\.?\d?)\s*out of\s*5/);
    const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 5;

    let title = "";
    const titlePatterns = [
      /data-hook="review-title"[\s\S]*?<span[^>]*>([^<]{2,})<\/span>/,
      /review-title[^>]*>(?:<[^>]+>)*\s*([^<]{3,})/,
    ];
    for (const p of titlePatterns) {
      const m = section.match(p);
      if (m) { title = m[1].trim(); break; }
    }

    let body = "";
    const bodyPatterns = [
      /review-text-content[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
      /review-text[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
      /data-hook="review-body"[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
    ];
    for (const p of bodyPatterns) {
      const m = section.match(p);
      if (m && m[1].trim().length > 10) {
        body = m[1].trim().replace(/<[^>]+>/g, "").trim();
        break;
      }
    }
    if (!body || body.length < 10) continue;

    const verified = section.includes("Verified Purchase");

    reviews.push({
      reviewerName,
      rating,
      title: title.substring(0, 200),
      body: body.substring(0, 1000),
      verifiedPurchase: verified,
    });
  }

  return reviews;
}

function getReviewCount(html: string): number {
  const match = html.match(/([\d,]+)\s*(?:global\s*)?ratings?/i);
  if (match) return parseInt(match[1].replace(/,/g, ""));
  return 0;
}

async function run() {
  const existingReviewProducts = await db.select({ productId: productReviews.productId }).from(productReviews);
  const reviewedIds = new Set(existingReviewProducts.map(r => r.productId));

  const allProducts = await db.select({
    id: products.id, amazonAsin: products.amazonAsin, name: products.name
  }).from(products).where(isNotNull(products.amazonAsin));

  const toProcess = allProducts.filter(p => p.amazonAsin && !reviewedIds.has(p.id));
  console.log(`Total with ASIN: ${allProducts.length} | Already reviewed: ${reviewedIds.size} | To check: ${toProcess.length}`);

  let checked = 0, withReviews = 0, reviewsAdded = 0, noReviews = 0, notFound = 0, blocked = 0, consecutiveBlocks = 0;

  for (const product of toProcess) {
    if (consecutiveBlocks >= 3) {
      console.log("3 consecutive blocks — pausing 60s...");
      await sleep(60000);
      consecutiveBlocks = 0;
    }

    const { html, status } = await fetchPage(`https://www.amazon.in/dp/${product.amazonAsin}`);
    checked++;

    if (status === 404) {
      notFound++;
      await sleep(1000);
      continue;
    }

    if (!html || status === 429) {
      blocked++;
      consecutiveBlocks++;
      console.log(`  BLOCKED (${status}): ${product.amazonAsin}`);
      await sleep(15000);
      continue;
    }
    consecutiveBlocks = 0;

    const ratingCount = getReviewCount(html);
    if (ratingCount === 0) {
      noReviews++;
    } else {
      const reviews = extractReviews(html);
      if (reviews.length > 0) {
        withReviews++;
        for (const review of reviews) {
          await db.insert(productReviews).values({
            productId: product.id,
            reviewerName: review.reviewerName,
            rating: review.rating,
            title: review.title || null,
            body: review.body,
            reviewDate: null,
            verifiedPurchase: review.verifiedPurchase,
          });
          reviewsAdded++;
        }
        console.log(`  + ${product.name?.substring(0, 50)}: ${reviews.length} reviews`);
      } else {
        noReviews++;
      }
    }

    if (checked % 10 === 0) {
      console.log(`  [${checked}/${toProcess.length}] Reviews: ${withReviews} prods (${reviewsAdded} total) | No reviews: ${noReviews} | 404: ${notFound} | Blocked: ${blocked}`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n=== REVIEW SCRAPE COMPLETE ===");
  console.log(`Checked: ${checked}`);
  console.log(`Products with reviews: ${withReviews}`);
  console.log(`No reviews: ${noReviews}`);
  console.log(`Not found (404): ${notFound}`);
  console.log(`Blocked: ${blocked}`);
  console.log(`Total reviews added: ${reviewsAdded}`);

  const totalReviews = await db.select({ count: sql<number>`count(*)` }).from(productReviews);
  console.log(`Total reviews in DB: ${totalReviews[0].count}`);
}

run().then(() => { console.log("Done!"); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
