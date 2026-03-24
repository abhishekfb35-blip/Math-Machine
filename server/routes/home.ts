import type { Express } from "express";
import { db } from "../db";
import { products, productTags, tags, categories } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";
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

interface HomeCollections {
  kids: Product[];
  couples: Product[];
  blankets: Product[];
  bathrobes: Product[];
}

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_COLLECTION = 4;

let cache: { bucket: number; data: HomeCollections } | null = null;

async function buildCollections(): Promise<HomeCollections> {
  const bucket = Math.floor(Date.now() / BUCKET_MS);

  if (cache && cache.bucket === bucket) {
    return cache.data;
  }

  const [kidsRows, couplesRows, blanketsRows, bathrobesRows] = await Promise.all([
    db.select({ id: products.id })
      .from(products)
      .innerJoin(productTags, eq(productTags.productId, products.id))
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(and(eq(products.active, true), eq(tags.name, "kids towels"))),

    db.select({ id: products.id })
      .from(products)
      .innerJoin(productTags, eq(productTags.productId, products.id))
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(and(eq(products.active, true), eq(tags.name, "couple towels"))),

    db.select({ id: products.id })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.active, true), eq(categories.slug, "blankets"))),

    db.select({ id: products.id })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.active, true), eq(categories.slug, "bathrobes"))),
  ]);

  const kidsIds = seededShuffle(kidsRows.map(r => r.id), bucket * 4 + 0).slice(0, PER_COLLECTION);
  const couplesIds = seededShuffle(couplesRows.map(r => r.id), bucket * 4 + 1).slice(0, PER_COLLECTION);
  const blanketsIds = seededShuffle(blanketsRows.map(r => r.id), bucket * 4 + 2).slice(0, PER_COLLECTION);
  const bathrobesIds = seededShuffle(bathrobesRows.map(r => r.id), bucket * 4 + 3).slice(0, PER_COLLECTION);

  const allIds = [...kidsIds, ...couplesIds, ...blanketsIds, ...bathrobesIds];
  const allProducts = await storage.getProductsByIds(allIds);
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const data: HomeCollections = {
    kids: kidsIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
    couples: couplesIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
    blankets: blanketsIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
    bathrobes: bathrobesIds.map(id => productMap.get(id)).filter(Boolean) as Product[],
  };

  cache = { bucket, data };
  return data;
}

export function registerHomeRoutes(app: Express) {
  app.get("/api/home/collections", async (_req, res) => {
    try {
      const data = await buildCollections();
      res.json(data);
    } catch (err) {
      console.error("Error building home collections:", err);
      res.status(500).json({ message: "Failed to load home collections" });
    }
  });
}
