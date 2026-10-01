import {
  getMetaCatalogGroupId,
  getMetaCatalogItemId,
} from "./metaCatalogIds";
import { siteOrigin } from "./discoverability";

export const META_CATALOG_CSV_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "item_group_id",
] as const;

export type MetaCatalogAvailability = "in stock" | "out of stock";

export interface MetaCatalogOptionColor {
  name: string;
  blurOnFront: boolean;
}

export interface MetaCatalogOptionSize {
  name: string;
  priceAdd: number;
  blurOnFront: boolean;
  colors: MetaCatalogOptionColor[];
}

export interface MetaCatalogSourceProduct {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    imageUrl: string;
    active: boolean | null;
  };
  sizes?: MetaCatalogOptionSize[];
  variants?: Array<{
    size: string;
    color: string;
    available: boolean;
  }>;
}

export interface MetaCatalogSettings {
  siteUrl: string;
  brandName: string;
}

export interface MetaCatalogRow {
  id: string;
  title: string;
  description: string;
  availability: MetaCatalogAvailability;
  condition: "new";
  price: string;
  link: string;
  image_link: string;
  brand: string;
  item_group_id: string;
}

export class MetaCatalogExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCatalogExportError";
  }
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    if (code.startsWith("#")) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function plainText(value: string | null): string {
  if (!value) return "";
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizedVariantValue(value: string | null | undefined): string {
  return value?.normalize("NFKC").trim().toLocaleLowerCase("en-US") ?? "";
}

function variantKey(size: string | null | undefined, color: string | null | undefined): string {
  return JSON.stringify([normalizedVariantValue(size), normalizedVariantValue(color)]);
}

function absolutePublicUrl(value: string, origin: string, field: string, productId: string): string {
  try {
    const url = new URL(value, `${origin}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported URL protocol");
    return url.toString();
  } catch {
    throw new MetaCatalogExportError(
      `Cannot export product ${productId}: its ${field} must be a valid public HTTP(S) URL.`,
    );
  }
}

function formatPrice(value: number, productId: string): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new MetaCatalogExportError(`Cannot export product ${productId}: its price must be a non-negative number.`);
  }
  return `${value.toFixed(2)} INR`;
}

function selectionsForProduct(source: MetaCatalogSourceProduct) {
  const { sizes = [], variants = [] } = source;
  const explicitAvailability = new Map<string, boolean[]>();
  for (const variant of variants) {
    const key = variantKey(variant.size, variant.color);
    const states = explicitAvailability.get(key) ?? [];
    states.push(variant.available);
    explicitAvailability.set(key, states);
  }

  const availabilityFor = (size: string | null, color: string | null): boolean => {
    if (variants.length === 0) return true;
    const states = explicitAvailability.get(variantKey(size, color));
    return Boolean(states?.length) && states!.every(Boolean);
  };

  if (sizes.length > 0) {
    const selections = sizes.flatMap(size => {
      const colors = size.colors;
      if (colors.length === 0) {
        return [{
          size: size.name,
          color: null as string | null,
          priceAdd: size.priceAdd,
          available: !size.blurOnFront && availabilityFor(size.name, null),
        }];
      }
      return colors.map(color => ({
        size: size.name,
        color: color.name,
        priceAdd: size.priceAdd,
        available: !size.blurOnFront && !color.blurOnFront && availabilityFor(size.name, color.name),
      }));
    });
    if (selections.length > 0) return selections;
  }

  // Some products have explicit variant availability rows but no category
  // size/color configuration. Preserve those variants in the feed.
  if (variants.length > 0) {
    const uniqueVariants = new Map<string, { size: string | null; color: string | null }>();
    for (const variant of variants) {
      const size = variant.size || null;
      const color = variant.color || null;
      if (!size && !color) continue;
      const key = variantKey(size, color);
      if (!uniqueVariants.has(key)) uniqueVariants.set(key, { size, color });
    }
    return [...uniqueVariants.values()].map(variant => ({
        size: variant.size,
        color: variant.color,
        priceAdd: 0,
        available: availabilityFor(variant.size, variant.color),
      }));
  }

  return [];
}

export function buildMetaCatalogRows(
  sources: MetaCatalogSourceProduct[],
  settings: MetaCatalogSettings,
): MetaCatalogRow[] {
  const activeSources = sources.filter(({ product }) => product.active === true);
  const productsMissingImages = activeSources
    .filter(({ product }) => !product.imageUrl?.trim())
    .map(({ product }) => product.name || product.id);
  if (productsMissingImages.length > 0) {
    const sample = productsMissingImages.slice(0, 5).join(", ");
    const extra = productsMissingImages.length > 5 ? ` and ${productsMissingImages.length - 5} more` : "";
    throw new MetaCatalogExportError(
      `Add a primary image to every active product before exporting. Missing images: ${sample}${extra}.`,
    );
  }

  const origin = siteOrigin(settings.siteUrl);
  const brandName = settings.brandName.trim() || "TurtleLittle";
  const rows: MetaCatalogRow[] = [];
  const seenIds = new Set<string>();

  for (const source of activeSources) {
    const { product } = source;
    const title = plainText(product.name);
    if (!product.id || !title) {
      throw new MetaCatalogExportError("Cannot export an active product with a missing ID or title.");
    }
    if (!product.slug?.trim()) {
      throw new MetaCatalogExportError(`Cannot export product ${product.id}: its public URL slug is missing.`);
    }

    const imageLink = absolutePublicUrl(product.imageUrl, origin, "image link", product.id);
    const link = absolutePublicUrl(`/product/${encodeURIComponent(product.slug)}`, origin, "product link", product.id);
    const selections = selectionsForProduct(source);
    const itemRows = selections.length > 0
      ? selections.map(selection => ({
          id: getMetaCatalogItemId(product.id, selection.size, selection.color),
          availability: selection.available ? "in stock" as const : "out of stock" as const,
          price: formatPrice(product.price + selection.priceAdd, product.id),
          item_group_id: getMetaCatalogGroupId(product.id),
        }))
      : [{
          id: product.id,
          availability: "in stock" as const,
          price: formatPrice(product.price, product.id),
          item_group_id: "",
        }];

    for (const item of itemRows) {
      if (seenIds.has(item.id)) {
        throw new MetaCatalogExportError(`Cannot export catalog: item ID ${item.id} is not unique.`);
      }
      seenIds.add(item.id);
      rows.push({
        ...item,
        title,
        description: plainText(product.description),
        condition: "new",
        link,
        image_link: imageLink,
        brand: brandName,
      });
    }
  }

  return rows;
}

export function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeMetaCatalogCsv(rows: MetaCatalogRow[]): string {
  const header = META_CATALOG_CSV_HEADERS.join(",");
  const body = rows.map(row =>
    META_CATALOG_CSV_HEADERS.map(column => escapeCsvCell(row[column])).join(","),
  );
  return [header, ...body].join("\r\n") + "\r\n";
}

export function buildMetaCatalogCsv(
  sources: MetaCatalogSourceProduct[],
  settings: MetaCatalogSettings,
): string {
  return serializeMetaCatalogCsv(buildMetaCatalogRows(sources, settings));
}