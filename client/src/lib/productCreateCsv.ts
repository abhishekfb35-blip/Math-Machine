import {
  duplicateProductCreateRows, productCreateColumns, productCreateRequiredColumns,
  productCreateRowSchema, type ProductCreateRow,
} from "@shared/productCreateImport";
import { parseCsvRows } from "./csvRows";

export type ProductCreatePreviewRow = {
  line: number;
  values: Record<string, string>;
  product?: ProductCreateRow;
  errors: string[];
};

const numericColumns = ["price", "mrp", "gsm", "weight_grams", "items_in_set", "sort_order"] as const;

export function parseProductCreateCsv(
  text: string,
  categories?: Set<string>,
  existingProducts?: Array<{ sku: string | null; slug: string }>,
): { headers: string[]; rows: ProductCreatePreviewRow[]; error?: string } {
  const parsed = parseCsvRows(text);
  if (parsed.error) return { headers: [], rows: [], error: parsed.error };
  if (!parsed.records.length) return { headers: [], rows: [], error: "CSV is empty" };
  const headers = parsed.records[0].values.map(value => value.trim());
  if (headers.some(header => !(productCreateColumns as readonly string[]).includes(header)) ||
      new Set(headers).size !== headers.length ||
      productCreateRequiredColumns.some(header => !headers.includes(header))) {
    return { headers, rows: [], error: `Headers must include ${productCreateRequiredColumns.join(", ")}; only the documented optional columns are accepted (no duplicates).` };
  }
  if (parsed.records.length === 1) return { headers, rows: [], error: "CSV has no product rows" };
  if (parsed.records.length > 1001) return { headers, rows: [], error: "A CSV can contain at most 1000 products" };
  const existingSkus = new Set(existingProducts?.map(p => p.sku?.toLocaleLowerCase()).filter(Boolean));
  const existingSlugs = new Set(existingProducts?.map(p => p.slug.toLocaleLowerCase()));
  const rows = parsed.records.slice(1).map(({ values: cells, line }): ProductCreatePreviewRow => {
    const values: Record<string, string> = Object.fromEntries(headers.map((header, i) => [header, cells[i]?.trim() ?? ""]));
    const errors: string[] = [];
    if (cells.length !== headers.length) errors.push(`Expected ${headers.length} columns, found ${cells.length}`);
    const numeric = Object.fromEntries(numericColumns.map(column => [
      column, values[column] ? (/^\d+$/.test(values[column]) ? Number(values[column]) : NaN) : undefined,
    ]));
    const active = values.active?.toLowerCase();
    const input = {
      sku: values.sku, name: values.name, slug: values.slug, price: numeric.price,
      categoryId: values.category_id, description: values.description || undefined,
      mrp: numeric.mrp, heroImageUrl: values.hero_image_url || undefined,
      color: values.color || undefined, material: values.material || undefined, gsm: numeric.gsm,
      dimensions: values.dimensions || undefined, weightGrams: numeric.weight_grams,
      itemsInSet: numeric.items_in_set, specialFeatures: values.special_features || undefined,
      bulletPoints: values.bullet_points ? values.bullet_points.split(/\r\n|\n|\r/).map(v => v.trim()).filter(Boolean) : undefined,
      searchKeywords: values.search_keywords || undefined, productType: values.product_type || undefined,
      active: !active ? undefined : active === "true" ? true : active === "false" ? false : values.active,
      sortOrder: numeric.sort_order,
    };
    const checked = productCreateRowSchema.safeParse(input);
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0]);
        const column = key === "categoryId" ? "category_id" : key === "heroImageUrl" ? "hero_image_url" :
          key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
        errors.push(`${column}: ${issue.message}`);
      }
    }
    if (values.category_id && categories && !categories.has(values.category_id)) errors.push("category_id: Category not found");
    if (values.sku && existingProducts && existingSkus.has(values.sku.toLocaleLowerCase())) errors.push("sku: Already exists");
    if (values.slug && existingProducts && existingSlugs.has(values.slug.toLocaleLowerCase())) errors.push("slug: Already exists");
    return { line, values, product: checked.success ? checked.data : undefined, errors };
  });
  for (const error of duplicateProductCreateRows(rows.map(row => ({
    sku: row.values.sku ?? "", slug: row.values.slug ?? "",
  })))) {
    rows[error.row - 2].errors.push(error.message);
  }
  return { headers, rows };
}