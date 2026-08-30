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

export interface SectionEntry {
  key: string;
  title: string;
  subtitle: string;
  filters: SectionFilters;
}

export const EMPTY_FILTERS: SectionFilters = {
  categoryFilters: [],
  audienceFilters: [],
  genderFilters: [],
  themeFilters: [],
  styleFilters: [],
  tagFilters: [],
};

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

export async function loadAllSectionFilters(): Promise<SectionEntry[]> {
  try {
    const config = await storage.getSiteContent("featuredSections");
    if (!config) return [];
    const parsed = JSON.parse(config.value);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: any) => item && typeof item === "object")
        .map((item: any) => ({
          key:      String(item.key      ?? `section-${Math.random().toString(36).slice(2, 7)}`),
          title:    String(item.title    ?? ""),
          subtitle: String(item.subtitle ?? ""),
          filters:  normaliseSectionFilters(item),
        }));
    }

    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([key, val]) => ({
        key,
        title:    String((val as any)?.title    ?? ""),
        subtitle: String((val as any)?.subtitle ?? ""),
        filters:  normaliseSectionFilters(val),
      }));
    }

    return [];
  } catch {
    return [];
  }
}

export async function getProductIdsByFilters(filters: SectionFilters): Promise<string[]> {
  const conditions: SQL[] = [eq(products.active, true)];

  if (filters.categoryFilters.length > 0) {
    conditions.push(inArray(categories.slug, filters.categoryFilters));
  }

  if (filters.audienceFilters.length > 0) {
    const ids = sql.join(filters.audienceFilters.map(id => sql`${id}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_audience pag
      WHERE pag.product_id = ${products.id}
      AND pag.audience_id = ANY(ARRAY[${ids}])
    )`);
  }

  if (filters.genderFilters.length > 0) {
    const ids = sql.join(filters.genderFilters.map(id => sql`${id}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_genders pg2
      WHERE pg2.product_id = ${products.id}
      AND pg2.gender_id = ANY(ARRAY[${ids}])
    )`);
  }

  if (filters.themeFilters.length > 0) {
    const ids = sql.join(filters.themeFilters.map(id => sql`${id}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_themes pt
      WHERE pt.product_id = ${products.id}
      AND pt.theme_id = ANY(ARRAY[${ids}])
    )`);
  }

  if (filters.styleFilters.length > 0) {
    const ids = sql.join(filters.styleFilters.map(id => sql`${id}`), sql`, `);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM product_styles ps
      WHERE ps.product_id = ${products.id}
      AND ps.style_id = ANY(ARRAY[${ids}])
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
