import type { Express } from "express";
import { storage } from "../storage";
import type { Product } from "@shared/types";
import {
  loadAllSectionFilters, getProductIdsByFilters, seededShuffle,
  SECTION_KEYS, type SectionKey,
} from "../lib/featuredQuery";

export interface HomeCollections {
  kids: Product[];
  couples: Product[];
  blankets: Product[];
  bathrobes: Product[];
}

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_COLLECTION = 6;

let cache: { bucket: number; data: HomeCollections } | null = null;

export function bustHomeCache() {
  cache = null;
}

async function buildCollections(): Promise<HomeCollections> {
  const bucket = Math.floor(Date.now() / BUCKET_MS);

  if (cache && cache.bucket === bucket) {
    return cache.data;
  }

  const allFilters = await loadAllSectionFilters();

  const [kidsIds, couplesIds, blanketsIds, bathrobesIds] = await Promise.all(
    SECTION_KEYS.map(k => getProductIdsByFilters(allFilters[k]))
  );

  const selectedKids      = seededShuffle(kidsIds,      bucket * 4 + 0).slice(0, PER_COLLECTION);
  const selectedCouples   = seededShuffle(couplesIds,   bucket * 4 + 1).slice(0, PER_COLLECTION);
  const selectedBlankets  = seededShuffle(blanketsIds,  bucket * 4 + 2).slice(0, PER_COLLECTION);
  const selectedBathrobes = seededShuffle(bathrobesIds, bucket * 4 + 3).slice(0, PER_COLLECTION);

  const allIds = [...selectedKids, ...selectedCouples, ...selectedBlankets, ...selectedBathrobes];
  const allProducts = await storage.getProductsByIds(allIds);
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const data: HomeCollections = {
    kids:      selectedKids.map(id      => productMap.get(id)).filter(Boolean) as Product[],
    couples:   selectedCouples.map(id   => productMap.get(id)).filter(Boolean) as Product[],
    blankets:  selectedBlankets.map(id  => productMap.get(id)).filter(Boolean) as Product[],
    bathrobes: selectedBathrobes.map(id => productMap.get(id)).filter(Boolean) as Product[],
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
