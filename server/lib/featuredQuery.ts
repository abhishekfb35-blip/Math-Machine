import { db } from "../db";
import { storage } from "../storage";
import {
  products, categories,
  productAudience, audience,
  productGenders, genders,
  productThemes, themes,
  productStyles, styles,
  productTags, tags,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export interface SectionFilters {
  categoryFilters: string[];
  audienceFilters: string[];
  genderFilters: string[];
  themeFilters: string[];
  styleFilters: string[];
  tagFilters: string[];
}

export const EMPTY_FILTERS: SectionFilters = {
  categoryFilters: [],
  audienceFilters: [],
  genderFilters: [],
  themeFilters: [],
  styleFilters: [],
  tagFilters: [],
};

export const SECTION_KEYS = ["kids", "couples", "blankets", "bathrobes"] as const;
export type SectionKey = typeof SECTION_KEYS[number];

function normaliseSectionFilters(raw: any): SectionFilters {
  return {
    categoryFilters: Array.isArray(raw?.categoryFilters) ? raw.categoryFilters : [],
    audienceFilters: Array.isArray(raw?.audienceFilters) ? raw.audienceFilters : [],
    genderFilters:   Array.isArray(raw?.genderFilters)   ? raw.genderFilters   : [],
    themeFilters:    Array.isArray(raw?.themeFilters)    ? raw.themeFilters    : [],
    styleFilters:    Array.isArray(raw?.styleFilters)    ? raw.styleFilters    : [],
    tagFilters:      Array.isArray(raw?.tagFilters)      ? raw.tagFilters      : [],
  };
}

export async function loadAllSectionFilters(): Promise<Record<SectionKey, SectionFilters>> {
  const result = {} as Record<SectionKey, SectionFilters>;
  for (const k of SECTION_KEYS) result[k] = { ...EMPTY_FILTERS };

  try {
    const config = await storage.getSiteContent("featuredSections");
    if (!config) return result;
    const parsed = JSON.parse(config.value) ?? {};
    for (const k of SECTION_KEYS) {
      result[k] = normaliseSectionFilters(parsed[k]);
    }
  } catch {
  }
  return result;
}

export async function getProductIdsByFilters(filters: SectionFilters): Promise<string[]> {
  const conditions: SQL[] = [eq(products.active, true)];

  if (filters.categoryFilters.length > 0) {
    conditions.push(inArray(categories.slug, filters.categoryFilters));
  }

  if (filters.audienceFilters.length > 0) {
    const names = sql.join(filters.audienceFilters.map(n => sql`${n}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_audience pag
      JOIN audience ag ON ag.id = pag.audience_id
      WHERE pag.product_id = ${products.id}
      AND ag.name = ANY(ARRAY[${names}])
    )`);
  }

  if (filters.genderFilters.length > 0) {
    const names = sql.join(filters.genderFilters.map(n => sql`${n}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_genders pg2
      JOIN genders g ON g.id = pg2.gender_id
      WHERE pg2.product_id = ${products.id}
      AND g.name = ANY(ARRAY[${names}])
    )`);
  }

  if (filters.themeFilters.length > 0) {
    const names = sql.join(filters.themeFilters.map(n => sql`${n}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_themes pt
      JOIN themes t ON t.id = pt.theme_id
      WHERE pt.product_id = ${products.id}
      AND t.name = ANY(ARRAY[${names}])
    )`);
  }

  if (filters.styleFilters.length > 0) {
    const names = sql.join(filters.styleFilters.map(n => sql`${n}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_styles ps
      JOIN styles s ON s.id = ps.style_id
      WHERE ps.product_id = ${products.id}
      AND s.name = ANY(ARRAY[${names}])
    )`);
  }

  if (filters.tagFilters.length > 0) {
    const names = sql.join(filters.tagFilters.map(n => sql`${n}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_tags ptag
      JOIN tags tg ON tg.id = ptag.tag_id
      WHERE ptag.product_id = ${products.id}
      AND tg.name = ANY(ARRAY[${names}])
    )`);
  }

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions));

  return rows.map(r => r.id);
}

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
