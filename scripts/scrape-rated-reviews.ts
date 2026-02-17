import { db } from "../server/db";
import { products, productReviews } from "../shared/schema";
import { eq, isNotNull, sql, inArray } from "drizzle-orm";

const DELAY_MS = 4000;

const RATED_ASINS = "B0CGR4YFFJ,B0FNN8Q258,B0FR9FL6GQ,B07891ZFXK,B075FL8SCH,B01N5MGPKF,B01NAGMK6H,B0F2XM4MTH,B082J777XW,B08KKCW7W9,B07DSM6DBL,B0BHV4FJJ1,B08QLXGS28,B0CB1L1MH3,B0C94FM8LW,B0CB1M9STS,B09PRNFZ4L,B075RTQ331,B0FGGJ9XN8,B081VQFNFD,B0DSCGC2B1,B0CQTZTQRL,B085DN5WT3,B07DSFR8BX,B078LSFJLC,B0CQTVGFZ5,B082K91H1M,B085DD8NPP,B0757ZDQC1,B01MU7MX31,B09MSZ2RWW,B07F2QDD9V,B08RWJ2Z4F,B09MSY6H57,B077S3VCF7,B09MSZ46PY,B0893JX77Y,B01MS4OVC8,B085DSNZ3H,B09GS3YM4K,B0CQDDSF93,B0FHC1RN7M,B09PRL2DLV,B07DS9T9K3,B0CB9FPL9B,B082J5YG85,B0CRPS36P6,B0CRPQPZX9,B09PRN7VFG,B0CQ74MBM3,B08RWNDDHX,B0CQTXV7VH,B01MS4CVJ0,B082JKXHQ1,B09H58SBFK,B0FF6GRT9L,B082QTTGKL,B078LM42T1,B0758433VL,B0FHC1RDN5,B0F2X6JPX3,B0FHBZCZ6N,B0DPTGV9L5,B0CB9M3NNC,B0CSXQ31XC,B0CW4J1DJB,B0FRVX2DKH,B0FHBZ8G89,B08HDCTYHL,B0D3WLDHL1,B0CZF71B5T,B0CRQHBM88,B0CB9N89DK,B0BBK6LYB1,B09PRP9DSF,B09PRP7NJQ,B09PRKPSGC,B091DVSRLR,B07581G57M,B01N30VS3Y,B01MU7WZLY,B078LT6CVH,B09PRMG79J,B0757T59YB,B08RW8K6P9,B0CRQKGF81,B0CW4PCY15,B0FS9C4BWK,B0D2BMXG7C,B0CRPPSLT4,B0FS8W8WQG,B0FHC1WG42,B0FF65WGZ5,B09GMT3PSJ,B0BW3WXMV1,B0FGQTCHJ1,B0CB9MCKWH,B09NKZVSPJ,B0G44WJVG9,B0CRQK8B1G,B0CRQK6BFP,B0CB9NR62J,B0C817FQYC,B0BQCBWDRW,B0DZ2S767V,B0FS3JCB5C,B0FHBYRR3T,B0F2XD2QDJ,B0CW4DC5R8,B0CSXPNNRH,B0CRPQ8XX2,B0FS8ZB82B,B0FS479KJT,B0FS35BVKZ,B0FF7HV9GJ,B0CS817H74,B0CRX97TYD,B0CQTXL9DZ,B0CQTV5H1P,B09J913LLW,B085DMQBWB,B0GJ12YKHM,B0G44ZZYTV,B0G44Y2C2S,B0G44XDM3G,B0G44W1FF7,B0G44VS2ZC,B0G44VQWCZ,B0G44RZ413,B0FS9Y74D3,B0FS9JWBVM,B0FS9GJRS3,B0FS8T2TW2,B0FS3JHBC5,B0FS3FVMRF,B0FS2ZCXWK,B0FRW1CLVF,B0FJZLQGH9,B0FHFHWTKT,B0FHC2TD91,B0FHC1HZF3,B0FHBZ78H1,B0FH5YYFZJ,B0FH5YJY83,B0FH5Y58ZS,B0FH5XBJMB,B0FH37QYJK,B0FH36GS85,B0FGRFC6ZW,B0FGQT9RJ5,B0FGGLBMJ6,B0FGG1GDF8,B0FGFYBND6,B0FGFS53L7,B0FF6N25JQ,B0F2X22P4C,B0F2WX6MWW,B0F2WC1W8R,B0F2VQGH4M,B0DXYP3XDZ,B0DG5ST36K,B0D446S6B7,B0D4441JYD,B0D4431MKX,B0D43XQ9JG,B0D43M96R1,B0D43CYY48,B0D436GCZ3,B0D435FTXY,B0D2LVYMRP,B0D2BNQJT9,B0D2BMCM6L,B0CZF8X526,B0CZF7PYTH,B0CZF65V54,B0CZF5H5WX,B0CZF4YSPN,B0CZF4P8QP,B0CYM4KNP4,B0CW4NX1QG,B0CW4K3J5K,B0CW478J1P,B0CW46JQZY,B0CSXRZRXZ,B0CSXRWZ22,B0CSXR9TMS,B0CSXR8SZC,B0CSXR5VVG,B0CSXQQGKG,B0CSXQHDG4,B0CSXQ2HGX,B0CSXQ26M5,B0CSXPFPPZ,B0CSXP9882,B0CS7WQ92Q,B0CRX1ZHKL,B0CRQJMSDN,B0CRQHJ6XX,B0CRQH64RJ,B0CRPSFMNL,B0CRPSCS96,B0CRPQ3RQ6,B0CRPPNX2S,B0CQV42YPK,B0CQV19988,B0CQTYC54F,B0CQTWRJGS,B0CQ75HSTK,B0CL5C89NB,B0CB9SX1X2,B0CB9NQ9J3,B0CB9N4VJG,B0CB9JT67F,B0BW45VLJJ,B0BW4291Z7,B0BW3TGWLS,B0BTK4Q824,B0B31JBZ4Q,B09PRSRM76,B09MKS8LH5,B09H55ZGCJ,B09GS2DDH2,B091DBZ328,B08RWMC8Z2,B08RW7ZVRB,B085DQP7H4,B07GD7DNN9,B078NB9CDQ,B0771MR4CY,B0771BBHJ7,B076XSPWQR,B075828HZH,B074FYHBMJ,B01N4KYI1D,B09FVKZSTZ,B0CB9K93L1,B0FH363PLR,B082BHG9XS".split(",");

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(asin: string): Promise<string | null> {
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
    const patterns = [
      /review-text-content[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
      /review-body[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/,
    ];
    for (const p of patterns) {
      const m = s.match(p);
      if (m && m[1].trim().length > 10) { body = m[1].replace(/<[^>]+>/g, "").trim(); break; }
    }
    if (body.length < 10) continue;
    reviews.push({
      reviewerName: name[1].trim(),
      rating: rat ? Math.round(parseFloat(rat[1])) : 5,
      title: title.substring(0, 200),
      body: body.substring(0, 1000),
      verifiedPurchase: s.includes("Verified Purchase"),
    });
  }
  return reviews;
}

async function run() {
  const reviewed = new Set((await db.select({ productId: productReviews.productId }).from(productReviews)).map(r => r.productId));
  const allProducts = await db.select({
    id: products.id, amazonAsin: products.amazonAsin, name: products.name
  }).from(products).where(isNotNull(products.amazonAsin));

  const asinToProduct = new Map(allProducts.map(p => [p.amazonAsin!, p]));

  const toScrape = RATED_ASINS.filter(asin => {
    const prod = asinToProduct.get(asin);
    return prod && !reviewed.has(prod.id);
  });

  console.log(`Rated ASINs from search: ${RATED_ASINS.length}`);
  console.log(`Matched in DB: ${RATED_ASINS.filter(a => asinToProduct.has(a)).length}`);
  console.log(`Already reviewed: ${RATED_ASINS.filter(a => { const p = asinToProduct.get(a); return p && reviewed.has(p.id); }).length}`);
  console.log(`To scrape: ${toScrape.length}`);

  let ok = 0, revs = 0, noRevs = 0, dead = 0, fail = 0, consBlock = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const asin = toScrape[i];
    const product = asinToProduct.get(asin)!;

    if (consBlock >= 3) {
      console.log("  3 consecutive blocks — pausing 60s...");
      await sleep(60000);
      consBlock = 0;
    }

    const html = await fetchPage(asin);

    if (html === "404") { dead++; await sleep(500); continue; }
    if (!html) { fail++; consBlock++; console.log(`  BLOCKED: ${asin}`); await sleep(15000); continue; }
    consBlock = 0;

    const rr = extractReviews(html);
    if (rr.length > 0) {
      ok++;
      for (const r of rr) {
        await db.insert(productReviews).values({
          productId: product.id,
          reviewerName: r.reviewerName,
          rating: r.rating,
          title: r.title || null,
          body: r.body,
          amzReviewDate: null,
          verifiedPurchase: r.verifiedPurchase,
        });
        revs++;
      }
      console.log(`  [${i + 1}/${toScrape.length}] + ${product.name?.substring(0, 45)}: ${rr.length} reviews`);
    } else {
      noRevs++;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${toScrape.length} | Found: ${ok} (${revs} reviews) | None: ${noRevs} | 404: ${dead} | Blocked: ${fail}`);
    }

    await sleep(DELAY_MS);
  }

  const total = await db.select({ count: sql<number>`count(*)` }).from(productReviews);
  console.log(`\n=== DONE ===`);
  console.log(`Products with reviews: ${ok} | Total reviews: ${revs} | No inline reviews: ${noRevs} | Dead: ${dead} | Blocked: ${fail}`);
  console.log(`Total reviews in DB: ${total[0].count}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
