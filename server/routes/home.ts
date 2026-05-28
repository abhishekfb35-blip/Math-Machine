import type { Express } from "express";
import { storage } from "../storage";
import type { Product } from "@shared/types";
import {
  loadAllSectionFilters, getProductIdsByFilters, seededShuffle,
  type SectionFilters,
} from "../lib/featuredQuery";

export interface HomeSection {
  key: string;
  title: string;
  subtitle: string;
  seeAllHref: string;
  products: Product[];
}

const BUCKET_MS = 12 * 60 * 60 * 1000;
const PER_COLLECTION = 6;

let cache: { bucket: number; data: HomeSection[] } | null = null;

export function bustHomeCache() {
  cache = null;
}

function buildSeeAllHref(filters: SectionFilters): string {
  const p = new URLSearchParams();
  if (filters.categoryFilters.length === 1) p.set("category", filters.categoryFilters[0]);
  if (filters.audienceFilters.length === 1) p.set("filter",   filters.audienceFilters[0]);
  if (filters.genderFilters.length)         p.set("gender",   filters.genderFilters.join(","));
  if (filters.themeFilters.length)          p.set("theme",    filters.themeFilters.join(","));
  if (filters.styleFilters.length)          p.set("style",    filters.styleFilters.join(","));
  if (filters.tagFilters.length === 1)      p.set("tag",      filters.tagFilters[0]);
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

async function buildCollections(): Promise<HomeSection[]> {
  const bucket = Math.floor(Date.now() / BUCKET_MS);

  if (cache && cache.bucket === bucket) {
    return cache.data;
  }

  const sections = await loadAllSectionFilters();

  if (sections.length === 0) {
    cache = { bucket, data: [] };
    return [];
  }

  const selectedIdSets = await Promise.all(
    sections.map((s, i) =>
      getProductIdsByFilters(s.filters).then(ids =>
        seededShuffle(ids, bucket * sections.length + i).slice(0, PER_COLLECTION)
      )
    )
  );

  const flatIds = [...new Set(selectedIdSets.flat())];
  const allProducts = await storage.getProductsByIds(flatIds);
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const data: HomeSection[] = sections.map((s, i) => ({
    key:        s.key,
    title:      s.title,
    subtitle:   s.subtitle,
    seeAllHref: buildSeeAllHref(s.filters),
    products:   selectedIdSets[i].map(id => productMap.get(id)).filter(Boolean) as Product[],
  }));

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
