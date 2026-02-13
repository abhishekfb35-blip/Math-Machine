import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";

const DELAY_MS = 4000;
const BATCH_LIMIT = parseInt(process.argv[2] || "20");

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(asin: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://www.amazon.in/dp/${asin}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
    });
    if (resp.status === 404) return "404";
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text.includes("Robot Check") || text.includes("CAPTCHA") || text.length < 5000) return null;
    return text;
  } catch { return null; }
}

function extractReviews(html: string) {
  const reviews: Array<{ reviewerName: string; rating: number; title: string; body: string; verifiedPurchase: boolean }> = [];
  const sections = html.split(/id="customer_review-[A-Z0-9]+"/);
  for (let i = 1; i < sections.length && reviews.length < 8; i++) {
    const s = sections[i];
    const name = s.match(/a-profile-name[^>]*>([^<]{2,40})</);
    if (!name) continue;
    const rat = s.match(/(\d\.?\d?)\s*out of\s*5/);
    let title = "";
    const tm = s.match(/review-title[\s\S]*?<span[^>]*>([^<]{2,})<\/span>/);
    if (tm) title = tm[1].trim();
    let body = "";
    const bm = s.match(/review-text-content[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/);
    if (bm) body = bm[1].replace(/<[^>]+>/g, "").trim();
    if (!body) { const bm2 = s.match(/review-body[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/); if (bm2) body = bm2[1].replace(/<[^>]+>/g, "").trim(); }
    if (body.length < 10) continue;
    reviews.push({ reviewerName: name[1].trim(), rating: rat ? Math.round(parseFloat(rat[1])) : 5, title: title.substring(0, 200), body: body.substring(0, 1000), verifiedPurchase: s.includes("Verified Purchase") });
  }
  return reviews;
}

async function run() {
  const reviewed = new Set((await db.select({ productId: productReviews.productId }).from(productReviews)).map(r => r.productId));
  const all = await db.select({ id: products.id, amazonAsin: products.amazonAsin, name: products.name }).from(products).where(isNotNull(products.amazonAsin));
  const todo = all.filter(p => p.amazonAsin && !reviewed.has(p.id));
  const batch = todo.slice(0, BATCH_LIMIT);
  console.log(`Batch: ${batch.length} of ${todo.length} remaining`);

  let ok = 0, revs = 0, none = 0, dead = 0, fail = 0;
  for (const p of batch) {
    const html = await fetchPage(p.amazonAsin!);
    if (html === "404") { dead++; await sleep(500); continue; }
    if (!html) { fail++; console.log(`  FAIL: ${p.amazonAsin}`); await sleep(10000); continue; }
    const rr = extractReviews(html);
    if (rr.length > 0) {
      ok++;
      for (const r of rr) {
        await db.insert(productReviews).values({ productId: p.id, reviewerName: r.reviewerName, rating: r.rating, title: r.title || null, body: r.body, reviewDate: null, verifiedPurchase: r.verifiedPurchase });
        revs++;
      }
      console.log(`  + ${p.name?.substring(0, 50)}: ${rr.length} reviews`);
    } else { none++; }
    await sleep(DELAY_MS);
  }
  const total = await db.select({ count: sql<number>`count(*)` }).from(productReviews);
  console.log(`\nBatch done: ${ok} with reviews (${revs} added), ${none} no reviews, ${dead} dead pages, ${fail} blocked`);
  console.log(`Total reviews in DB: ${total[0].count} | Remaining products: ${todo.length - batch.length}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
