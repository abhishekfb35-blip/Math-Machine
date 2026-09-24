import pluralize from "pluralize";

export interface ProductSearchableFields {
  name: string;
  sku?: string | null;
  description?: string | null;
}

export function getProductSearchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function getProductSearchWordVariants(term: string): string[] {
  const word = term.toLowerCase();
  if (!/^[a-z]{3,}$/.test(word)) return [];

  const variants = new Set([pluralize.singular(word), pluralize.plural(word)]);
  variants.delete(word);
  return [...variants].filter(variant => /^[a-z]{3,}$/.test(variant));
}

export function matchesProductSearch(query: string, product: ProductSearchableFields): boolean {
  const terms = getProductSearchTerms(query);
  if (terms.length === 0) return false;

  const searchableFields = [
    product.name,
    product.sku ?? "",
    product.description ?? "",
  ].map(value => value.toLowerCase());

  return terms.every(term => {
    if (searchableFields.some(field => field.includes(term))) return true;

    return getProductSearchWordVariants(term).some(variant => {
      const wholeWord = new RegExp(`(^|[^\\p{L}\\p{N}])${variant}(?=$|[^\\p{L}\\p{N}])`, "u");
      return searchableFields.some(field => wholeWord.test(field));
    });
  });
}