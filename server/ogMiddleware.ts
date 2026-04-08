import { type Express, type Request, type Response, type NextFunction } from "express";
import { type IStorage } from "./storage";

const CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "whatsapp",
  "twitterbot",
  "googlebot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
  "applebot",
  "bingbot",
  "yandexbot",
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => ua.includes(p));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveProductImageUrl(rawPath: string, siteUrl: string): string {
  if (!rawPath) return `${siteUrl}/og-image.png`;
  if (rawPath.startsWith("http")) return rawPath;
  if (
    rawPath.startsWith("/images/products/") &&
    !rawPath.includes("/small/") &&
    !rawPath.includes("/medium/") &&
    !rawPath.includes("/large/")
  ) {
    const filename = rawPath.replace("/images/products/", "");
    return `${siteUrl}/images/products/medium/${filename}`;
  }
  return `${siteUrl}${rawPath}`;
}

const DEFAULT_SEO = {
  brandName: "TurtleLittle",
  tagline: "Personalised Luxury Towels & Blankets",
  metaDescription: "Premium embroidered towels and blankets personalised with your name. Buy 2 Get 1 Free offer!",
  ogImageUrl: "/og-image.jpg",
  siteUrl: "https://turtlelittle.com",
};

async function getSeoConfig(storage: IStorage): Promise<typeof DEFAULT_SEO> {
  try {
    const row = await storage.getSiteConfig("seo");
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_SEO, ...parsed };
    }
  } catch {}
  return DEFAULT_SEO;
}

function buildSiteOgHtml(seo: typeof DEFAULT_SEO): string {
  const base = seo.siteUrl.split("?")[0].replace(/\/$/, "") || "https://turtlelittle.com";
  const title = escapeHtml(`${seo.brandName} — ${seo.tagline}`);
  const description = escapeHtml(seo.metaDescription);
  const canonicalUrl = escapeHtml(base);
  const shareUrl = escapeHtml(seo.siteUrl);

  let imageUrl: string;
  if (seo.ogImageUrl.startsWith("http")) {
    imageUrl = seo.ogImageUrl;
  } else {
    imageUrl = `${base}${seo.ogImageUrl.startsWith("/") ? "" : "/"}${seo.ogImageUrl}`;
  }
  const safeImage = encodeURI(imageUrl);
  const imageType = safeImage.endsWith(".png") ? "image/png" : "image/jpeg";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:type" content="${imageType}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(seo.brandName)}" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${safeImage}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${canonicalUrl}">Shop Now</a>
</body>
</html>`;
}

export function setupOgMiddleware(app: Express, storage: IStorage) {
  app.get("/", async (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isCrawler(ua)) return next();
    try {
      const seo = await getSeoConfig(storage);
      res.status(200).set({ "Content-Type": "text/html" }).end(buildSiteOgHtml(seo));
    } catch {
      next();
    }
  });

  app.get("/product/:slug", async (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isCrawler(ua)) return next();

    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) return next();

      const siteUrl = "https://turtlelittle.com";
      const productUrl = `${siteUrl}/product/${product.slug}`;

      const rawImagePath = product.imageUrl || (() => {
        storage.getProductImages(product.id).then((imgs) => imgs[0]?.imageUrl ?? "");
        return "";
      })();

      const imageUrl = resolveProductImageUrl(rawImagePath, siteUrl);

      const rawDesc = product.description
        ? product.description.replace(/\n/g, " ").slice(0, 160)
        : `Personalised ${product.name} — luxury embroidered towel by TurtleLittle. Buy 2 Get 1 Free!`;

      const title = escapeHtml(`${product.name} | TurtleLittle`);
      const description = escapeHtml(rawDesc);
      const safeImage = encodeURI(imageUrl);
      const safeUrl = encodeURI(productUrl);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TurtleLittle" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${safeImage}" />
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${description}</p>
  <a href="${safeUrl}">View on TurtleLittle</a>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      next(e);
    }
  });
}
