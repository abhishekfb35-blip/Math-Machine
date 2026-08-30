export const ID_BEARING_SEED_TABLES = [
  "tagTypes",
  "categories",
  "tags",
  "products",
  "productImages",
  "productReviews",
  "productTags",
  "audience",
  "genders",
  "themes",
  "styles",
  "productAudience",
  "productGenders",
  "productThemes",
  "productStyles",
  "currencyRates",
  "pricingRules",
  "categoryTagVariantConfigs",
  "variantSizes",
  "variantColors",
  "productVariants",
  "occasions",
  "bulkPriceRules",
  "colorSwatches",
  "categorySizeDefinitions",
] as const;

export function validateSeedSnapshotIds(snapshot: Record<string, unknown>): void {
  const errors: string[] = [];

  for (const table of ID_BEARING_SEED_TABLES) {
    const rawRows = snapshot[table];
    if (rawRows === undefined || rawRows === null) continue;

    if (!Array.isArray(rawRows)) {
      errors.push(`${table} must be an array`);
      continue;
    }

    rawRows.forEach((row, index) => {
      const id = row && typeof row === "object" && !Array.isArray(row)
        ? (row as { id?: unknown }).id
        : undefined;
      if (typeof id !== "string" || id.trim() === "") {
        errors.push(`${table}[${index}] is missing a non-empty string "id"`);
      }

      const relationIdField: Record<string, string> = {
        productAudience: "audienceId",
        productGenders: "genderId",
        productThemes: "themeId",
        productStyles: "styleId",
      };
      const field = relationIdField[table];
      if (field) {
        const relationId = row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)[field]
          : undefined;
        if (typeof relationId !== "string" || relationId.trim() === "") {
          errors.push(`${table}[${index}] is missing a non-empty string "${field}"`);
        }
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `[seed] Aborting before writes: every ID-bearing seed row must provide its existing ID. ${errors.slice(0, 10).join("; ")}`,
    );
  }
}