import { hasProductFilters, type ProductFilterConfig } from "./productFilters";

export interface HomeSectionSeeAllFilters {
  categoryFilters: readonly string[];
  audienceFilters: readonly string[];
}

export interface HomepageCardFilters extends ProductFilterConfig {
  link: string;
}

export function buildHomepageCardHref(card: HomepageCardFilters): string {
  if (!hasProductFilters(card)) return card.link;

  const params = new URLSearchParams();
  if (card.categoryFilters?.length) params.set("category", card.categoryFilters.join(","));
  if (card.audienceFilters?.length) params.set("filter", card.audienceFilters.join(","));
  if (card.genderFilters?.length) params.set("gender", card.genderFilters.join(","));
  if (card.themeFilters?.length) params.set("theme", card.themeFilters.join(","));
  if (card.styleFilters?.length) params.set("style", card.styleFilters.join(","));
  if (card.tagFilters?.length) params.set("productTag", card.tagFilters.join(","));

  return `/shop?${params.toString()}`;
}

export function buildHomeSectionSeeAllHref(filters: HomeSectionSeeAllFilters): string {
  const params = new URLSearchParams();
  if (filters.categoryFilters.length === 1) {
    params.set("category", filters.categoryFilters[0]);
  }
  if (filters.audienceFilters.length) {
    params.set("filter", filters.audienceFilters.join(","));
  }

  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}