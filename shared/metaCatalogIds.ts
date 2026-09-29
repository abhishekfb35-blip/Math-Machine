export type MetaCatalogContentType = "product" | "product_group";

export interface MetaCatalogTrackingIdentity {
  id: string;
  contentType: MetaCatalogContentType;
}

function normalizeVariantValue(value?: string | null): string {
  return value?.normalize("NFKC").trim().toLocaleLowerCase("en-US") ?? "";
}

function hashVariant(size: string, color: string): string {
  const input = JSON.stringify([size, color]);
  const bytes = new TextEncoder().encode(input);
  let hash = 0xcbf29ce484222325n;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(36);
}

/**
 * Canonical Meta feed item ID for a product or a selected size/color variant.
 * The catalog CSV exporter must use this same function for variant-row `id`
 * values and getMetaCatalogGroupId for their `item_group_id`.
 */
export function getMetaCatalogItemId(
  productId: string,
  selectedSize?: string | null,
  selectedColor?: string | null,
): string {
  const size = normalizeVariantValue(selectedSize);
  const color = normalizeVariantValue(selectedColor);
  if (!size && !color) return productId;
  return `${productId}__${hashVariant(size, color)}`;
}

/** Parent group ID shared by the feed's variant rows and product-page events. */
export function getMetaCatalogGroupId(productId: string): string {
  return productId;
}

/**
 * Resolve the ID and Meta content type for a selected cart/order item.
 * Composite color selections represent a product group rather than one
 * individual variant row.
 */
export function getMetaCatalogTrackingIdentity(
  productId: string,
  selectedSize?: string | null,
  selectedColor?: string | null,
): MetaCatalogTrackingIdentity {
  if (selectedColor?.includes(" · ")) {
    return { id: getMetaCatalogGroupId(productId), contentType: "product_group" };
  }

  return {
    id: getMetaCatalogItemId(productId, selectedSize, selectedColor),
    contentType: "product",
  };
}