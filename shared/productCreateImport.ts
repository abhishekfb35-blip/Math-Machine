import { z } from "zod";
import { isImageReference } from "./productImageImport";

export const productCreateRequiredColumns = ["sku", "name", "slug", "price", "category_id"] as const;
export const productCreateColumns = [
  ...productCreateRequiredColumns,
  "description", "mrp", "hero_image_url", "color", "material", "gsm", "dimensions",
  "weight_grams", "items_in_set", "special_features", "bullet_points", "search_keywords",
  "product_type", "active", "sort_order",
] as const;

const required = z.string().trim().min(1);
const positiveInteger = z.number().int().min(1).max(2147483647);
const nonnegativeInteger = z.number().int().min(0).max(2147483647);
const optionalText = z.string().trim().optional();

export const productCreateRowSchema = z.object({
  sku: required,
  name: required,
  slug: required,
  price: positiveInteger,
  categoryId: required,
  description: optionalText,
  mrp: positiveInteger.optional(),
  heroImageUrl: z.string().trim().refine(value => !value || isImageReference(value), "Use an http(s) URL or a site-relative path starting with /").optional(),
  color: optionalText,
  material: z.string().trim().optional().transform(value => value || "100% cotton"),
  gsm: positiveInteger.optional().default(500),
  dimensions: optionalText,
  weightGrams: nonnegativeInteger.optional(),
  itemsInSet: positiveInteger.optional(),
  specialFeatures: optionalText,
  bulletPoints: z.array(z.string().trim().min(1)).optional(),
  searchKeywords: optionalText,
  productType: optionalText,
  active: z.boolean().optional(),
  sortOrder: nonnegativeInteger.optional(),
}).strict();

export const productCreateImportSchema = z.object({
  rows: z.array(productCreateRowSchema).min(1).max(1000),
}).strict();

export type ProductCreateRow = z.output<typeof productCreateRowSchema>;

export type ProductCreateError = { row: number; message: string };

export function duplicateProductCreateRows(rows: Pick<ProductCreateRow, "sku" | "slug">[]): ProductCreateError[] {
  const errors: ProductCreateError[] = [];
  for (const field of ["sku", "slug"] as const) {
    const seen = new Map<string, number>();
    rows.forEach((row, index) => {
      const value = row[field].toLocaleLowerCase();
      if (!value) return;
      const previous = seen.get(value);
      if (previous !== undefined) {
        errors.push({ row: previous + 2, message: `Duplicate ${field.toUpperCase()} in CSV` });
        errors.push({ row: index + 2, message: `Duplicate ${field.toUpperCase()} in CSV` });
      } else {
        seen.set(value, index);
      }
    });
  }
  return errors.filter((error, index) =>
    errors.findIndex(other => other.row === error.row && other.message === error.message) === index);
}