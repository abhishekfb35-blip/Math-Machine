import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import fs from "fs";

const DELAY_MS = 4000;
const LOG_FILE = "/tmp/review-scrape.log";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(asin: string): Promise<{ html: string | null; code: number }> {
  try {
    const resp = await fetch(`https://www.amazon.in/dp/${asin}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (resp.status === 404) return { html: null, code: 404 };
    if (!resp.ok) return { html: null, code: resp.status };
    const text = await resp.text();
    if (text.includes("Robot Check") || text.includes("CAPTCHA") || text.length < 5000)
      return { html: null, code: 429 };
    return { html: text, code: 200 };
  } catch { return { html: null, code: 0 }; }
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
  fs.writeFileSync(LOG_FILE, "");
  log("Starting review scrape...");

  const reviewed = new Set((await db.select({ productId: productReviews.productId }).from(productReviews)).map(r => r.productId));
  const all = await db.select({ id: products.id, amazonAsin: products.amazonAsin, name: products.name }).from(products).where(isNotNull(products.amazonAsin));
  const todo = all.filter(p => p.amazonAsin && !reviewed.has(p.id));
  log(`To check: ${todo.length} (${reviewed.size} already done)`);

  let ok = 0, revs = 0, none = 0, dead = 0, fail = 0, consBlock = 0;

  for (let idx = 0; idx < todo.length; idx++) {
    const p = todo[idx];
    if (consBlock >= 5) {
      log("5 consecutive blocks — waiting 120s...");
      await sleep(120000);
      consBlock = 0;
    }

    const { html, code } = await fetchPage(p.amazonAsin!);

    if (code === 404) { dead++; await sleep(500); continue; }
    if (!html) { fail++; consBlock++; log(`BLOCKED ${p.amazonAsin} (code ${code})`); await sleep(15000); continue; }
    consBlock = 0;

    const rr = extractReviews(html);
    if (rr.length > 0) {
      ok++;
      for (const r of rr) {
        await db.insert(productReviews).values({ productId: p.id, reviewerName: r.reviewerName, rating: r.rating, title: r.title || null, body: r.body, reviewDate: null, verifiedPurchase: r.verifiedPurchase });
        revs++;
      }
      log(`+ [${idx + 1}/${todo.length}] ${p.name?.substring(0, 40)}: ${rr.length} reviews`);
    } else { none++; }

    if ((idx + 1) % 20 === 0) {
      log(`Progress [${idx + 1}/${todo.length}] reviews_found=${ok} total_reviews=${revs} no_reviews=${none} dead=${dead} blocked=${fail}`);
    }

    await sleep(DELAY_MS);
  }

  const total = await db.select({ count: sql<number>`count(*)` }).from(productReviews);
  log(`DONE: ${ok} products with reviews (${revs} added), ${none} no reviews, ${dead} dead, ${fail} blocked. Total in DB: ${total[0].count}`);
}

run().then(() => process.exit(0)).catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
