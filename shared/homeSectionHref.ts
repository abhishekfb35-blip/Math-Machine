export interface HomeSectionSeeAllFilters {
  categoryFilters: readonly string[];
  audienceFilters: readonly string[];
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