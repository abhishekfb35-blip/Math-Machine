import type { Express } from "express";
import { storage } from "../storage";

const SITE_URL = "https://turtlelittle.com";
const GOOGLE_PRODUCT_NAMESPACE = "http://base.google.com/ns/1.0";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textOnly(value: string | null | undefined, maxLength: number): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function absoluteUrl(value: string): string | null {
  try {
    return new URL(value, SITE_URL).toString();
  } catch {
    return null;
  }
}

function feedElement(name: string, value: string | null | undefined): string {
  if (!value) return "";
  return `      <${name}>${escapeXml(value)}</${name}>\n`;
}

export function registerMerchantRoutes(app: Express) {
  app.get("/google-merchant-feed.xml", async (_req, res) => {
    try {
      const [products, categories] = await Promise.all([
        storage.getProducts(),
        storage.getCategories(),
      ]);
      const categoryNames = new Map(categories.map(category => [category.id, category.name]));

      const items = products.flatMap(product => {
        const imageLink = absoluteUrl(product.imageUrl);
        const productUrl = absoluteUrl(`/product/${product.slug}`);
        const price = Number(product.price);
        if (!imageLink || !productUrl || !Number.isFinite(price) || price < 0) return [];

        const title = textOnly(product.name, 150);
        const description = textOnly(product.description || product.name, 5000);
        const itemId = textOnly(product.sku || product.id, 100);
        if (!title || !description || !itemId) return [];

        const lines = [
          "    <item>",
          feedElement("g:id", itemId).trimEnd(),
          feedElement("g:title", title).trimEnd(),
          feedElement("g:description", description).trimEnd(),
          feedElement("g:link", productUrl).trimEnd(),
          feedElement("g:image_link", imageLink).trimEnd(),
          feedElement("g:availability", "in stock").trimEnd(),
          feedElement("g:price", `${price.toFixed(2)} INR`).trimEnd(),
          feedElement("g:condition", "new").trimEnd(),
          feedElement("g:brand", "TurtleLittle").trimEnd(),
          feedElement("g:product_type", categoryNames.get(product.categoryId) || product.productType || "Home & Garden").trimEnd(),
        ];

        if (product.sku) {
          lines.push(feedElement("g:mpn", textOnly(product.sku, 70)).trimEnd());
        } else {
          lines.push(feedElement("g:identifier_exists", "no").trimEnd());
        }

        lines.push("    </item>");
        return [`${lines.filter(Boolean).join("\n")}\n`];
      });

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<rss version="2.0" xmlns:g="${GOOGLE_PRODUCT_NAMESPACE}">`,
        "  <channel>",
        feedElement("title", "TurtleLittle Product Feed").trimEnd(),
        feedElement("link", SITE_URL).trimEnd(),
        feedElement("description", "TurtleLittle products").trimEnd(),
        ...items,
        "  </channel>",
        "</rss>",
        "",
      ].filter(Boolean).join("\n");

      res
        .set("Content-Type", "application/xml; charset=utf-8")
        .set("Cache-Control", "public, max-age=300")
        .send(xml);
    } catch (error) {
      console.error("Merchant feed error:", error);
      res.status(500).type("text/plain").send("Unable to generate product feed");
    }
  });
}