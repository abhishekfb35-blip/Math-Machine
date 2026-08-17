/**
 * CatalogService — business logic extracted from server/routes/admin/catalog.ts.
 *
 * Owns:
 *   - Bulk attribute operations (update / remove / replace / clear + undo)
 *   - Undo-token store for bulk-clear (server-side, never round-tripped)
 *   - Combined catalog-by-category data fetch
 *   - Bulk image upload with per-product file copy
 *
 * All data access goes through `storage` (IStorage). No raw DB imports.
 */

import { storage } from "../storage";
import { fileStorage } from "../providers/fileStorage";

// ── Undo store ────────────────────────────────────────────────────────────────

type ClearSnapshot = {
  productId: string;
  audienceIds: string[];
  genderIds: string[];
  themeIds: string[];
  styleIds: string[];
  tagIds: string[];
};

const UNDO_TTL_MS = 60_000;
const clearUndoStore = new Map<string, { snapshot: ClearSnapshot[]; expiresAt: number }>();

// ── Attribute helpers ─────────────────────────────────────────────────────────

const union    = (a: string[], b: string[]) => [...new Set([...a, ...b])];
const subtract = (existing: string[], toRemove: string[]) => existing.filter(id => !toRemove.includes(id));

export type AttributeSet = {
  audienceIds?: string[];
  genderIds?:   string[];
  themeIds?:    string[];
  styleIds?:    string[];
  tagIds?:      string[];
};

// ── Combined catalog fetch ────────────────────────────────────────────────────

/**
 * Loads products, tag maps, and images for a category in one call.
 * Used by GET /api/admin/catalog/category/:categoryId.
 */
export async function getCatalogByCategory(categoryId: string) {
  const [prods, { productTagMap, productTagNameMap }, productImages] = await Promise.all([
    storage.getAllProductsByCategoryNoTags(categoryId),
    storage.getProductTagsForCatalog(categoryId),
    storage.getProductImagesByCategory(categoryId),
  ]);
  const products = prods.map(p => ({ ...p, tagNames: productTagNameMap[p.id] ?? [] }));
  return { products, productTagMap, productImages };
}

// ── Bulk attribute operations ─────────────────────────────────────────────────

/** Unions `attrs` into each product's existing attributes. */
export async function bulkUpdateAttributes(
  productIds: string[],
  attrs: AttributeSet,
  username: string,
): Promise<number> {
  const needsAttrs = attrs.audienceIds !== undefined || attrs.genderIds !== undefined
    || attrs.themeIds !== undefined || attrs.styleIds !== undefined;

  await Promise.all(productIds.map(async (productId) => {
    const [existing, existingTagIds] = await Promise.all([
      needsAttrs ? storage.getProductAttributeIds(productId)
                 : Promise.resolve({ audienceIds: [], genderIds: [], themeIds: [], styleIds: [] }),
      attrs.tagIds !== undefined ? storage.getProductTagIds(productId) : Promise.resolve([]),
    ]);
    await Promise.all([
      attrs.audienceIds !== undefined ? storage.setProductAudiences(productId, union(existing.audienceIds, attrs.audienceIds)) : Promise.resolve(),
      attrs.genderIds   !== undefined ? storage.setProductGenders  (productId, union(existing.genderIds,   attrs.genderIds))   : Promise.resolve(),
      attrs.themeIds    !== undefined ? storage.setProductThemes   (productId, union(existing.themeIds,    attrs.themeIds))    : Promise.resolve(),
      attrs.styleIds    !== undefined ? storage.setProductStyles   (productId, union(existing.styleIds,    attrs.styleIds))    : Promise.resolve(),
      attrs.tagIds      !== undefined ? storage.setProductTags     (productId, union(existingTagIds,       attrs.tagIds))      : Promise.resolve(),
    ]);
  }));

  await storage.createAuditLog({
    entityType: "product", entityId: productIds.join(","), entityName: `${productIds.length} products`,
    action: "bulk-update-attributes", changes: JSON.stringify({ productIds, ...attrs }), username,
  });
  return productIds.length;
}

/** Removes `attrs` from each product's existing attributes. */
export async function bulkRemoveAttributes(
  productIds: string[],
  attrs: AttributeSet,
  username: string,
): Promise<number> {
  const needsAttrs = attrs.audienceIds !== undefined || attrs.genderIds !== undefined
    || attrs.themeIds !== undefined || attrs.styleIds !== undefined;

  await Promise.all(productIds.map(async (productId) => {
    const [existing, existingTagIds] = await Promise.all([
      needsAttrs ? storage.getProductAttributeIds(productId)
                 : Promise.resolve({ audienceIds: [], genderIds: [], themeIds: [], styleIds: [] }),
      attrs.tagIds !== undefined ? storage.getProductTagIds(productId) : Promise.resolve([]),
    ]);
    await Promise.all([
      attrs.audienceIds !== undefined ? storage.setProductAudiences(productId, subtract(existing.audienceIds, attrs.audienceIds)) : Promise.resolve(),
      attrs.genderIds   !== undefined ? storage.setProductGenders  (productId, subtract(existing.genderIds,   attrs.genderIds))   : Promise.resolve(),
      attrs.themeIds    !== undefined ? storage.setProductThemes   (productId, subtract(existing.themeIds,    attrs.themeIds))    : Promise.resolve(),
      attrs.styleIds    !== undefined ? storage.setProductStyles   (productId, subtract(existing.styleIds,    attrs.styleIds))    : Promise.resolve(),
      attrs.tagIds      !== undefined ? storage.setProductTags     (productId, subtract(existingTagIds,       attrs.tagIds))      : Promise.resolve(),
    ]);
  }));

  await storage.createAuditLog({
    entityType: "product", entityId: productIds.join(","), entityName: `${productIds.length} products`,
    action: "bulk-remove-attributes", changes: JSON.stringify({ productIds, ...attrs }), username,
  });
  return productIds.length;
}

/** Replaces each product's attributes wholesale (no merge). */
export async function bulkReplaceAttributes(
  productIds: string[],
  attrs: AttributeSet,
  username: string,
): Promise<number> {
  await Promise.all(productIds.map(async (productId) => {
    await Promise.all([
      attrs.audienceIds !== undefined ? storage.setProductAudiences(productId, attrs.audienceIds) : Promise.resolve(),
      attrs.genderIds   !== undefined ? storage.setProductGenders  (productId, attrs.genderIds)   : Promise.resolve(),
      attrs.themeIds    !== undefined ? storage.setProductThemes   (productId, attrs.themeIds)     : Promise.resolve(),
      attrs.styleIds    !== undefined ? storage.setProductStyles   (productId, attrs.styleIds)     : Promise.resolve(),
      attrs.tagIds      !== undefined ? storage.setProductTags     (productId, attrs.tagIds)       : Promise.resolve(),
    ]);
  }));

  await storage.createAuditLog({
    entityType: "product", entityId: productIds.join(","), entityName: `${productIds.length} products`,
    action: "bulk-replace-attributes", changes: JSON.stringify({ productIds, ...attrs }), username,
  });
  return productIds.length;
}

/**
 * Captures a before-snapshot, issues an undo token (server-side only),
 * then clears all attributes for each product.
 */
export async function bulkClearAttributes(
  productIds: string[],
  username: string,
): Promise<{ updated: number; undoToken: string }> {
  // 1. Capture snapshot FIRST, before any writes
  const snapshot: ClearSnapshot[] = await Promise.all(productIds.map(async (productId) => {
    const [attrs, tagIds] = await Promise.all([
      storage.getProductAttributeIds(productId),
      storage.getProductTagIds(productId),
    ]);
    return { productId, ...attrs, tagIds };
  }));

  // 2. Store server-side with a short-lived token
  const undoToken = crypto.randomUUID();
  clearUndoStore.set(undoToken, { snapshot, expiresAt: Date.now() + UNDO_TTL_MS });

  // 3. Clear all attributes
  await Promise.all(productIds.map(async (productId) => {
    await Promise.all([
      storage.setProductAudiences(productId, []),
      storage.setProductGenders  (productId, []),
      storage.setProductThemes   (productId, []),
      storage.setProductStyles   (productId, []),
      storage.setProductTags     (productId, []),
    ]);
  }));

  await storage.createAuditLog({
    entityType: "product", entityId: productIds.join(","), entityName: `${productIds.length} products`,
    action: "bulk-clear-attributes", changes: JSON.stringify({ productIds }), username,
  });
  return { updated: productIds.length, undoToken };
}

/**
 * Restores a previously captured clear-snapshot by undo token.
 * Returns `{ expired: true }` if the token is missing or past TTL.
 */
export async function bulkRestoreAttributes(
  undoToken: string,
  username: string,
): Promise<{ updated: number } | { expired: true }> {
  const entry = clearUndoStore.get(undoToken);
  if (!entry || Date.now() > entry.expiresAt) {
    clearUndoStore.delete(undoToken);
    return { expired: true };
  }

  const { snapshot } = entry;
  clearUndoStore.delete(undoToken);

  await Promise.all(snapshot.map(async ({ productId, audienceIds, genderIds, themeIds, styleIds, tagIds }) => {
    await Promise.all([
      storage.setProductAudiences(productId, audienceIds),
      storage.setProductGenders  (productId, genderIds),
      storage.setProductThemes   (productId, themeIds),
      storage.setProductStyles   (productId, styleIds),
      storage.setProductTags     (productId, tagIds),
    ]);
  }));

  await storage.createAuditLog({
    entityType: "product",
    entityId: snapshot.map(s => s.productId).join(","),
    entityName: `${snapshot.length} products`,
    action: "bulk-restore-attributes",
    changes: JSON.stringify({ productIds: snapshot.map(s => s.productId) }),
    username,
  });
  return { updated: snapshot.length };
}

// ── Bulk image upload ─────────────────────────────────────────────────────────

/**
 * Copies image slots to each product. The first product reuses the original URLs;
 * subsequent products get file-storage copies to avoid shared references.
 */
export async function bulkUploadImages(
  productIds: string[],
  imageSlots: Array<{ sortOrder: number; sourceUrl: string }>,
): Promise<number> {
  for (let i = 0; i < productIds.length; i++) {
    const perProductSlots: { sortOrder: number; imageUrl: string }[] = [];
    for (const slot of imageSlots) {
      if (i === 0) {
        perProductSlots.push({ sortOrder: slot.sortOrder, imageUrl: slot.sourceUrl });
      } else {
        const copied = await fileStorage.copy(slot.sourceUrl);
        perProductSlots.push({ sortOrder: slot.sortOrder, imageUrl: copied.url });
      }
    }
    await storage.bulkReplaceProductImages([productIds[i]], perProductSlots);
  }
  return productIds.length;
}
