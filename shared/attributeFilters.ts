export interface AttributeIdFilters {
  audienceId?: string;
  genderId?: string;
  themeId?: string;
  styleId?: string;
}

export interface ProductAttributeRelations {
  audience?: string[];
  genders?: string[];
  themes?: string[];
  styles?: string[];
}

export function matchesAttributeIds(
  product: ProductAttributeRelations,
  filters: AttributeIdFilters,
): boolean {
  return (!filters.audienceId || product.audience?.includes(filters.audienceId) === true)
    && (!filters.genderId || product.genders?.includes(filters.genderId) === true)
    && (!filters.themeId || product.themes?.includes(filters.themeId) === true)
    && (!filters.styleId || product.styles?.includes(filters.styleId) === true);
}

export function filterProductsByAttributeIds<T extends ProductAttributeRelations>(
  products: T[],
  filters: AttributeIdFilters,
): T[] {
  return products.filter(product => matchesAttributeIds(product, filters));
}