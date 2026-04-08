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

const SITE_OG_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>TurtleLittle — Personalised Luxury Towels &amp; Blankets</title>
  <meta name="description" content="Premium embroidered towels and blankets personalised with your name. Buy 2 Get 1 Free offer!" />
  <link rel="canonical" href="https://turtlelittle.com" />
  <meta property="og:title" content="TurtleLittle — Personalised Luxury Towels &amp; Blankets" />
  <meta property="og:description" content="Premium embroidered towels and blankets personalised with your name. Buy 2 Get 1 Free offer!" />
  <meta property="og:image" content="https://turtlelittle.com/og-image.jpg" />
  <meta property="og:image:secure_url" content="https://turtlelittle.com/og-image.jpg" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="https://turtlelittle.com" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TurtleLittle" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="TurtleLittle — Personalised Luxury Towels &amp; Blankets" />
  <meta name="twitter:description" content="Premium embroidered towels and blankets personalised with your name. Buy 2 Get 1 Free offer!" />
  <meta name="twitter:image" content="https://turtlelittle.com/og-image.jpg" />
</head>
<body>
  <h1>TurtleLittle — Personalised Luxury Towels &amp; Blankets</h1>
  <p>Premium embroidered towels and blankets personalised with your name. Buy 2 Get 1 Free offer!</p>
  <a href="https://turtlelittle.com">Shop Now</a>
</body>
</html>`;

export function setupOgMiddleware(app: Express, storage: IStorage) {
  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isCrawler(ua)) return next();
    res.status(200).set({ "Content-Type": "text/html" }).end(SITE_OG_HTML);
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
