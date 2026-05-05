import { db } from "../db";
import { productImages } from "@shared/schema";
import { inArray } from "drizzle-orm";
import type { Product } from "@shared/types";

export async function enrichWithImages(prods: Product[]): Promise<Product[]> {
  const missing = Array.from(new Set(prods.filter(p => !p.imageUrl).map(p => p.id)));
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

export async function enrichItemsWithImages<T extends { productId: string | null; imageUrl: string | null | undefined }>(
  items: T[]
): Promise<T[]> {
  const missingIds = Array.from(new Set(items.filter(i => i.productId && !i.imageUrl).map(i => i.productId as string)));
  if (missingIds.length === 0) return items;
  const rows = await db
    .select({ productId: productImages.productId, imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(inArray(productImages.productId, missingIds))
    .orderBy(productImages.sortOrder);
  const imageMap = new Map<string, string>();
  for (const r of rows) {
    if (!imageMap.has(r.productId)) imageMap.set(r.productId, r.imageUrl);
  }
  return items.map(i =>
    (i.productId && !i.imageUrl && imageMap.has(i.productId))
      ? { ...i, imageUrl: imageMap.get(i.productId)! }
      : i
  );
}
