import type { Express } from "express";
import { siteOrigin } from "@shared/discoverability";
import { storage, type IStorage } from "../storage";

type SeoStorage = Pick<IStorage, "getSiteContent" | "getCategories" | "getProducts">;

async function configuredSiteOrigin(storage: SeoStorage): Promise<string> {
  try {
    const row = await storage.getSiteContent("seo");
    const config: unknown = row?.value ? JSON.parse(row.value) : null;
    if (config && typeof config === "object" && !Array.isArray(config) && "siteUrl" in config) {
      return siteOrigin(config.siteUrl);
    }
  } catch (error) {
    console.error("Could not load SEO site origin; using default:", error);
  }
  return siteOrigin(null);
}

export function registerSeoRoutes(app: Express, seoStorage: SeoStorage = storage) {
  app.get("/robots.txt", async (_req, res) => {
    const baseUrl = await configuredSiteOrigin(seoStorage);
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout
Disallow: /cart
Disallow: /order/
Disallow: /signin
Disallow: /account

Sitemap: ${baseUrl}/sitemap.xml
`;
    res.set("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  app.get("/llms.txt", async (_req, res) => {
    const baseUrl = await configuredSiteOrigin(seoStorage);
    res.type("text/plain").send(`# TurtleLittle
> Personalised embroidered towels, blankets and bathrobes for kids, adults and couples.

## Official pages
- [Shop all products](${baseUrl}/shop): Browse available products and categories.
- [About TurtleLittle](${baseUrl}/about): Learn about the brand and its products.
- [Shipping policy](${baseUrl}/shipping): Current processing, delivery and tracking information.
- [Refund and cancellation policy](${baseUrl}/refund-policy): Return eligibility and cancellation details.
- [Contact](${baseUrl}/contact): Customer support and business details.

## Delivery
- Delivery is available only to addresses within India. International delivery is not offered.

Product prices, availability, delivery terms and policies may change. Check the linked pages for current details.
`);
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const [categories, products, baseUrl] = await Promise.all([
        seoStorage.getCategories(),
        seoStorage.getProducts(),
        configuredSiteOrigin(seoStorage),
      ]);
      const today = new Date().toISOString().split("T")[0];

      const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "daily" },
        { loc: "/shop", priority: "0.9", changefreq: "daily" },
        { loc: "/about", priority: "0.5", changefreq: "monthly" },
        { loc: "/contact", priority: "0.3", changefreq: "monthly" },
        { loc: "/terms", priority: "0.3", changefreq: "yearly" },
        { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
        { loc: "/refund-policy", priority: "0.3", changefreq: "yearly" },
        { loc: "/shipping", priority: "0.3", changefreq: "yearly" },
      ];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const page of staticPages) {
        xml += `  <url>\n    <loc>${baseUrl}${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
      }

      for (const cat of categories) {
        xml += `  <url>\n    <loc>${baseUrl}/category/${cat.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      for (const product of products) {
        if (!product.active) continue;
        const lastmod = product.updatedAt ? new Date(product.updatedAt).toISOString().split("T")[0] : today;
        xml += `  <url>\n    <loc>${baseUrl}/product/${product.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;
      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });
}
