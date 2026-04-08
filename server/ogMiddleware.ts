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

export function setupOgMiddleware(app: Express, storage: IStorage) {
  app.get("/product/:slug", async (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isCrawler(ua)) return next();

    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) return next();

      const images = await storage.getProductImages(product.id);

      const siteUrl = "https://turtlelittle.com";
      const productUrl = `${siteUrl}/product/${product.slug}`;

      const firstImage = images.find((img) => img.isPrimary) ?? images[0];
      const rawImagePath = firstImage?.imageUrl ?? "";
      const resolvedImagePath = rawImagePath.startsWith("/images/products/") &&
        !rawImagePath.includes("/small/") &&
        !rawImagePath.includes("/medium/") &&
        !rawImagePath.includes("/large/")
          ? `/images/products/small/${rawImagePath.replace("/images/products/", "")}`
          : rawImagePath;
      const imageUrl = resolvedImagePath
        ? `${siteUrl}${resolvedImagePath}`
        : `${siteUrl}/og-image.png`;

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
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:type" content="product" />
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
