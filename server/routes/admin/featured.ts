import type { Express } from "express";
import { storage } from "../../storage";
import { requirePermission } from "../../adminAuth";
import type { Product } from "@shared/types";
import {
  loadAllSectionFilters, getProductIdsByFilters, seededShuffle,
  EMPTY_FILTERS, type SectionFilters,
} from "../../lib/featuredQuery";

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_SECTION = 6;

export function registerAdminFeaturedRoutes(app: Express) {
  app.get("/api/admin/featured-products", requirePermission("catalog"), async (_req, res) => {
    try {
      const bucket = Math.floor(Date.now() / BUCKET_MS);
      const sections = await loadAllSectionFilters();

      const idSets = await Promise.all(
        sections.map((s, i) =>
          getProductIdsByFilters(s.filters).then(ids =>
            seededShuffle(ids, bucket * Math.max(sections.length, 1) + i).slice(0, PER_SECTION)
          )
        )
      );

      const allIds = [...new Set(idSets.flat())];
      const allProducts = await storage.getProductsByIds(allIds);
      const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));

      const result: Record<string, Product[]> = {};
      sections.forEach((s, i) => {
        result[s.key] = idSets[i].map(id => productMap.get(id)).filter(Boolean) as Product[];
      });

      res.json(result);
    } catch (err) {
      console.error("Error building admin featured products:", err);
      res.status(500).json({ message: "Failed to load featured products" });
    }
  });

  app.post("/api/admin/featured-products/preview", requirePermission("catalog"), async (req, res) => {
    try {
      const filters: SectionFilters = {
        categoryFilters: Array.isArray(req.body.categoryFilters) ? req.body.categoryFilters : [],
        audienceFilters: Array.isArray(req.body.audienceFilters) ? req.body.audienceFilters : [],
        genderFilters:   Array.isArray(req.body.genderFilters)   ? req.body.genderFilters   : [],
        themeFilters:    Array.isArray(req.body.themeFilters)    ? req.body.themeFilters    : [],
        styleFilters:    Array.isArray(req.body.styleFilters)    ? req.body.styleFilters    : [],
        tagFilters:      Array.isArray(req.body.tagFilters)      ? req.body.tagFilters      : [],
      };

      const bucket = Math.floor(Date.now() / BUCKET_MS);
      const ids = await getProductIdsByFilters(filters);
      const selectedIds = seededShuffle(ids, bucket).slice(0, PER_SECTION);

      const allProducts = await storage.getProductsByIds(selectedIds);
      const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));
      const products = selectedIds.map(id => productMap.get(id)).filter(Boolean) as Product[];

      res.json({ products, total: ids.length });
    } catch (err) {
      console.error("Error previewing featured products:", err);
      res.status(500).json({ message: "Failed to preview featured products" });
    }
  });
}
