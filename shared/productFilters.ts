import type { Category, Product } from "./types";

export interface ProductFilterConfig {
  categoryFilters?: readonly string[];
  audienceFilters?: readonly string[];
  genderFilters?: readonly string[];
  themeFilters?: readonly string[];
  styleFilters?: readonly string[];
  tagFilters?: readonly string[];
}

export function hasProductFilters(filters: ProductFilterConfig): boolean {
  return [
    filters.categoryFilters,
    filters.audienceFilters,
    filters.genderFilters,
    filters.themeFilters,
    filters.styleFilters,
    filters.tagFilters,
  ].some(values => (values?.length ?? 0) > 0);
}

export function productMatchesFilters(
  product: Product,
  categories: Category[],
  filters: ProductFilterConfig,
): boolean {
  const categoryFilters = filters.categoryFilters ?? [];
  const audienceFilters = filters.audienceFilters ?? [];
  const genderFilters = filters.genderFilters ?? [];
  const themeFilters = filters.themeFilters ?? [];
  const styleFilters = filters.styleFilters ?? [];
  const tagFilters = filters.tagFilters ?? [];

  if (categoryFilters.length && !categories.some(category =>
    category.id === product.categoryId && categoryFilters.includes(category.slug),
  )) return false;
  if (audienceFilters.length && !audienceFilters.some(value => product.audience?.includes(value))) return false;
  if (genderFilters.length && !genderFilters.some(value => product.genders?.includes(value))) return false;
  if (themeFilters.length && !themeFilters.some(value => product.themes?.includes(value))) return false;
  if (styleFilters.length && !styleFilters.some(value => product.styles?.includes(value))) return false;
  if (tagFilters.length && !tagFilters.some(filter => (product.tagNames ?? []).some(tag =>
    tag.toLocaleLowerCase() === filter.toLocaleLowerCase(),
  ))) return false;

  return product.active === true;
}
