export interface ProductSearchableFields {
  name: string;
  sku?: string | null;
  description?: string | null;
}

export function getProductSearchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesProductSearch(query: string, product: ProductSearchableFields): boolean {
  const terms = getProductSearchTerms(query);
  if (terms.length === 0) return false;

  const searchableFields = [
    product.name,
    product.sku ?? "",
    product.description ?? "",
  ].map(value => value.toLowerCase());

  return terms.every(term => searchableFields.some(field => field.includes(term)));
}