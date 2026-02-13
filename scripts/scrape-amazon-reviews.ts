import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";

const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAmazonPage(asin: string): Promise<string | null> {
  try {
    const url = `https://www.amazon.in/dp/${asin}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractGSM(html: string): number | null {
  const patterns = [
    /(\d{3,4})\s*GSM/i,
    /GSM[:\s]*(\d{3,4})/i,
    /fabric_weight[^>]*>(\d{3,4})/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractReviews(html: string): Array<{
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
}> {
  const reviews: Array<{
    reviewerName: string;
    rating: number;
    title: string;
    body: string;
    verifiedPurchase: boolean;
  }> = [];

  const reviewBlocks = html.match(/data-hook="review"[^]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

  for (const block of reviewBlocks) {
    const nameMatch = block.match(/class="a-profile-name"[^>]*>([^<]+)/);
    const ratingMatch = block.match(/(\d\.?\d?) out of 5 stars/);
    const titleMatch = block.match(/data-hook="review-title"[^>]*>(?:<[^>]+>)*([^<]+)/);
    const bodyMatch = block.match(/data-hook="review-body"[^>]*>(?:<[^>]+>)*\s*([^<]+)/);
    const verified = block.includes("Verified Purchase");

    if (nameMatch && ratingMatch && bodyMatch) {
      const body = bodyMatch[1].trim();
      if (body.length > 5) {
        reviews.push({
          reviewerName: nameMatch[1].trim(),
          rating: Math.round(parseFloat(ratingMatch[1])),
          title: titleMatch ? titleMatch[1].trim() : "",
          body,
          verifiedPurchase: verified,
        });
      }
    }
  }

  if (reviews.length === 0) {
    const altBlocks = html.split(/id="customer_review-/);
    for (let i = 1; i < altBlocks.length && i <= 10; i++) {
      const block = altBlocks[i];
      const nameMatch = block.match(/class="a-profile-name"[^>]*>([^<]+)/);
      const ratingMatch = block.match(/(\d\.?\d?) out of 5/);
      const titleMatch = block.match(/review-title[^>]*>(?:<[^>]+>)*([^<]+)/);
      const bodyMatch = block.match(/review-text[^>]*>(?:<[^>]+>)*\s*([^<]+)/);
      const verified = block.includes("Verified Purchase");

      if (nameMatch && bodyMatch) {
        reviews.push({
          reviewerName: nameMatch[1].trim(),
          rating: ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 5,
          title: titleMatch ? titleMatch[1].trim() : "",
          body: bodyMatch[1].trim().substring(0, 500),
          verifiedPurchase: verified,
        });
      }
    }
  }

  return reviews.slice(0, 8);
}

async function run() {
  const productsWithAsin = await db.select().from(products)
    .where(isNotNull(products.amazonAsin));

  const existingReviews = await db.select({ productId: productReviews.productId }).from(productReviews);
  const reviewedProductIds = new Set(existingReviews.map(r => r.productId));

  const toProcess = productsWithAsin.filter(p => !reviewedProductIds.has(p.id));
  console.log(`Products with ASIN: ${productsWithAsin.length}`);
  console.log(`Already have reviews: ${reviewedProductIds.size}`);
  console.log(`To process: ${toProcess.length}`);

  let processed = 0, reviewsAdded = 0, gsmUpdated = 0, failed = 0;

  for (const product of toProcess) {
    if (!product.amazonAsin) continue;

    const html = await fetchAmazonPage(product.amazonAsin);
    if (!html) {
      failed++;
      if (failed > 10) { console.log("Too many failures, stopping"); break; }
      await sleep(5000);
      continue;
    }

    if (html.includes("Robot Check") || html.includes("captcha")) {
      console.log("  CAPTCHA detected! Waiting 30s...");
      await sleep(30000);
      const retry = await fetchAmazonPage(product.amazonAsin);
      if (!retry || retry.includes("Robot Check")) {
        console.log("  Still blocked. Stopping.");
        break;
      }
    }

    if (!product.gsm) {
      const gsm = extractGSM(html);
      if (gsm) {
        await db.update(products).set({ gsm }).where(eq(products.id, product.id));
        gsmUpdated++;
      }
    }

    const reviews = extractReviews(html);
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

    processed++;
    if (processed % 5 === 0) {
      console.log(`  Processed: ${processed}/${toProcess.length} | Reviews: ${reviewsAdded} | GSM updates: ${gsmUpdated} | Failed: ${failed}`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n=== SCRAPE COMPLETE ===");
  console.log(`Processed: ${processed}`);
  console.log(`Reviews added: ${reviewsAdded}`);
  console.log(`GSM updated: ${gsmUpdated}`);
  console.log(`Failed: ${failed}`);
}

run().then(() => { console.log("Done!"); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
