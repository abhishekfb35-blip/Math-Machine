import { z } from "zod";

export const imageImportColumns = ["product_id", "image_url", "image_sequence_number"] as const;

export function isImageReference(value: string): boolean {
  if (/^\/(?!\/)[^\s?#]+(?:\?[^\s#]*)?$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch {
    return false;
  }
}

export const imageImportRowSchema = z.object({
  productId: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).refine(isImageReference, "Use an http(s) URL or a site-relative path starting with /"),
  imageSequenceNumber: z.number().int().min(2).max(2147483647),
}).strict();

export const imageImportSchema = z.object({
  rows: z.array(imageImportRowSchema).min(1).max(1000),
}).strict();

export type ImageImportRow = z.infer<typeof imageImportRowSchema>;
export type ImageImportTarget = Pick<ImageImportRow, "productId" | "imageSequenceNumber">;

export function duplicateImageImportRows(rows: readonly ImageImportTarget[]): number[] {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();
  rows.forEach((row, index) => {
    const key = `${row.productId}\0${row.imageSequenceNumber}`;
    if (seen.has(key)) {
      duplicates.add(seen.get(key)!);
      duplicates.add(index);
    } else {
      seen.set(key, index);
    }
  });
  return [...duplicates];
}