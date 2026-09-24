export function selectedAudienceIds(filter: string): string[] {
  return filter === "all" ? [] : filter.split(",").filter(Boolean);
}

export function matchesAudience(values: readonly string[] | undefined, filter: string): boolean {
  const selected = selectedAudienceIds(filter);
  return selected.length === 0 || selected.some(id => values?.includes(id));
}