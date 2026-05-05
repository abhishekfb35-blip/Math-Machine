import type { Express } from "express";
import { storage } from "../../storage";
import { requirePermission } from "../../adminAuth";
import type { Product } from "@shared/types";
import {
  loadAllSectionFilters, getProductIdsByFilters, seededShuffle,
  SECTION_KEYS, EMPTY_FILTERS, type SectionFilters,
} from "../../lib/featuredQuery";
import { db } from "../../db";
import { productImages } from "@shared/schema";
import { inArray } from "drizzle-orm";

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_SECTION = 6;

async function enrichWithImages(prods: Product[]): Promise<Product[]> {
  const missing = prods.filter(p => !p.imageUrl).map(p => p.id);
  if (missing.length === 0) return prods;
  const rows = await db
    .select({ productId: productImages.productId, imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(inArray(productImages.productId, missing))
    .orderBy(productImages.sortOrder);
  const imageMap = new Map<string, string>();
  for (const r of rows) {
    if (!imageMap.has(r.productId)) imageMap.set(r.productId, r.imageUrl);
  }
  return prods.map(p => (!p.imageUrl && imageMap.has(p.id)) ? { ...p, imageUrl: imageMap.get(p.id)! } : p);
}

export function registerAdminFeaturedRoutes(app: Express) {
  // GET — returns products for all 4 sections based on saved config
  app.get("/api/admin/featured-products", requirePermission("catalog"), async (_req, res) => {
    try {
      const bucket = Math.floor(Date.now() / BUCKET_MS);
      const allFilters = await loadAllSectionFilters();

      const idSets = await Promise.all(
        SECTION_KEYS.map(k => getProductIdsByFilters(allFilters[k]))
      );

      const selectedIdSets = idSets.map((ids, i) =>
        seededShuffle(ids, bucket * SECTION_KEYS.length + i).slice(0, PER_SECTION)
      );

      const allIds = selectedIdSets.flat();
      const rawProducts = await storage.getProductsByIds(allIds);
      const allProducts = await enrichWithImages(rawProducts);
      const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));

      const result: Record<string, Product[]> = {};
      SECTION_KEYS.forEach((k, i) => {
        result[k] = selectedIdSets[i].map(id => productMap.get(id)).filter(Boolean) as Product[];
      });

      res.json(result);
    } catch (err) {
      console.error("Error building admin featured products:", err);
      res.status(500).json({ message: "Failed to load featured products" });
    }
  });

  // POST preview — returns products matching caller-supplied filters (no cache)
  app.post("/api/admin/featured-products/preview", requirePermission("catalog"), async (req, res) => {
    try {
      const filters: SectionFilters = {
        categoryFilters: Array.isArray(req.body.categoryFilters) ? req.body.categoryFilters : [],
        ageGroupFilters: Array.isArray(req.body.ageGroupFilters) ? req.body.ageGroupFilters : [],
        genderFilters:   Array.isArray(req.body.genderFilters)   ? req.body.genderFilters   : [],
        themeFilters:    Array.isArray(req.body.themeFilters)    ? req.body.themeFilters    : [],
        styleFilters:    Array.isArray(req.body.styleFilters)    ? req.body.styleFilters    : [],
        tagFilters:      Array.isArray(req.body.tagFilters)      ? req.body.tagFilters      : [],
      };

      const bucket = Math.floor(Date.now() / BUCKET_MS);
      const ids = await getProductIdsByFilters(filters);
      const selectedIds = seededShuffle(ids, bucket).slice(0, PER_SECTION);

      const rawProducts = await storage.getProductsByIds(selectedIds);
      const allProducts = await enrichWithImages(rawProducts);
      const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));
      const products = selectedIds.map(id => productMap.get(id)).filter(Boolean) as Product[];

      res.json({ products, total: ids.length });
    } catch (err) {
      console.error("Error previewing featured products:", err);
      res.status(500).json({ message: "Failed to preview featured products" });
    }
  });
}
