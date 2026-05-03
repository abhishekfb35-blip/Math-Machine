import type { Express } from "express";
import { db } from "../../db";
import { products, categories, productAgeGroups, ageGroups } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../../storage";
import { requirePermission } from "../../adminAuth";
import type { Product } from "@shared/types";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_SECTION = 6;

async function getIdsByCategoryAndAge(categorySlug: string, ageGroupName: string): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(productAgeGroups, eq(productAgeGroups.productId, products.id))
    .innerJoin(ageGroups, eq(productAgeGroups.ageGroupId, ageGroups.id))
    .where(and(
      eq(products.active, true),
      eq(categories.slug, categorySlug),
      eq(ageGroups.name, ageGroupName),
    ));
  return rows.map(r => r.id);
}

async function getIdsByCategory(categorySlug: string): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(
      eq(products.active, true),
      eq(categories.slug, categorySlug),
    ));
  return rows.map(r => r.id);
}

export function registerAdminFeaturedRoutes(app: Express) {
  app.get("/api/admin/featured-products", requirePermission("catalog"), async (_req, res) => {
    try {
      const bucket = Math.floor(Date.now() / BUCKET_MS);

      const [kidsIds, blanketsIds, bathrobesIds] = await Promise.all([
        getIdsByCategoryAndAge("towels", "kids"),
        getIdsByCategory("blankets"),
        getIdsByCategory("bathrobes"),
      ]);

      const selectedKidsIds      = seededShuffle(kidsIds,      bucket * 3 + 0).slice(0, PER_SECTION);
      const selectedBlanketsIds  = seededShuffle(blanketsIds,  bucket * 3 + 1).slice(0, PER_SECTION);
      const selectedBathrobesIds = seededShuffle(bathrobesIds, bucket * 3 + 2).slice(0, PER_SECTION);

      const allIds = [...selectedKidsIds, ...selectedBlanketsIds, ...selectedBathrobesIds];
      const allProducts = await storage.getProductsByIds(allIds);
      const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));

      res.json({
        kids:      selectedKidsIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
        blankets:  selectedBlanketsIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
        bathrobes: selectedBathrobesIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
      });
    } catch (err) {
      console.error("Error building admin featured products:", err);
      res.status(500).json({ message: "Failed to load featured products" });
    }
  });
}
