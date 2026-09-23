import { duplicateImageImportRows, imageImportColumns, imageImportRowSchema, type ImageImportRow } from "@shared/productImageImport";

export type ImageCsvPreviewRow = {
  line: number;
  productId: string;
  imageUrl: string;
  imageSequenceNumber: string;
  errors: string[];
};

// Parse quoted CSV cells (including escaped quotes and embedded newlines) while retaining source line numbers.
export function parseImageCsv(text: string, knownProductIds?: Set<string>): { rows: ImageCsvPreviewRow[]; error?: string } {
  const cells: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let afterQuote = false;
  let line = 1;
  let rowLine = 1;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { inQuotes = false; afterQuote = true; }
      else { cell += char; if (char === "\n") line++; }
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      afterQuote = false;
      if (char !== ",") {
        if (row.length > 1 || row[0].trim() !== "") { cells.push(row); lines.push(rowLine); }
        row = [];
        if (char === "\r" && source[i + 1] === "\n") i++;
        line++;
        rowLine = line;
      }
    } else if (char === '"' && cell === "" && !afterQuote) {
      inQuotes = true;
    } else {
      if (char === '"' || afterQuote) return { rows: [], error: `Malformed CSV near line ${line}` };
      cell += char;
    }
  }
  if (inQuotes) return { rows: [], error: `Unclosed quote near line ${rowLine}` };
  row.push(cell);
  if (row.length > 1 || row[0].trim() !== "") { cells.push(row); lines.push(rowLine); }
  if (cells.length === 0) return { rows: [], error: "CSV is empty" };
  const headers = cells[0].map(value => value.trim());
  if (headers.length !== imageImportColumns.length || imageImportColumns.some((column, index) => headers[index] !== column)) {
    return { rows: [], error: `Expected headers in this order: ${imageImportColumns.join(", ")}` };
  }
  if (cells.length === 1) return { rows: [], error: "CSV has no image rows" };
  if (cells.length > 1001) return { rows: [], error: "A CSV can contain at most 1000 image rows" };

  const rows = cells.slice(1).map((values, index): ImageCsvPreviewRow => {
    const [productId = "", imageUrl = "", imageSequenceNumber = ""] = values.map(value => value.trim());
    const errors: string[] = [];
    if (values.length !== 3) errors.push("Expected exactly 3 columns");
    const parsed = imageImportRowSchema.safeParse({
      productId, imageUrl,
      imageSequenceNumber: /^\d+$/.test(imageSequenceNumber) ? Number(imageSequenceNumber) : NaN,
    });
    if (!parsed.success) errors.push(...parsed.error.issues.map(issue => {
      if (issue.path[0] === "productId") return "Product ID is required";
      if (issue.path[0] === "imageUrl") return imageUrl ? issue.message : "Image URL is required";
      return "Sequence must be a whole number of 2 or greater";
    }));
    if (productId && knownProductIds && !knownProductIds.has(productId)) errors.push("Product ID not found");
    return { line: lines[index + 1], productId, imageUrl, imageSequenceNumber, errors };
  });
  const validRows: ImageImportRow[] = rows.map(r => ({
    productId: r.productId, imageUrl: r.imageUrl, imageSequenceNumber: Number(r.imageSequenceNumber),
  }));
  duplicateImageImportRows(validRows).forEach(index => rows[index].errors.push("Duplicate product/sequence pair"));
  return { rows };
}