import type { Category, Product } from "./types";

export interface ShopSection {
  label: string;
  /** Stable section key used by existing shop filter URLs. */
  tag?: string;
  /** Product tag filters; do not derive these from `tag`. */
  tags?: string[];
  categories?: string[];
  /** Legacy preview setting retained when reading older saved configs. */
  maxShown: number;
  enabled: boolean;
  audience?: string[];
  genders?: string[];
  themes?: string[];
  styles?: string[];
}

export interface ShopSectionProductGroup extends ShopSection {
  all: Product[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string")
      .map(entry => entry.trim())
      .filter(Boolean)
    : [];
}

export function normalizeShopSections(value: unknown): ShopSection[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ShopSection[] => {
    if (!isRecord(entry) || typeof entry.label !== "string" || !entry.label.trim()) return [];
    const label = entry.label.trim();
    const maxShown = typeof entry.maxShown === "number" && Number.isFinite(entry.maxShown) && entry.maxShown > 0
      ? Math.floor(entry.maxShown)
      : 8;

    return [{
      label,
      tag: typeof entry.tag === "string" && entry.tag.trim() ? entry.tag.trim() : label,
      tags: stringArray(entry.tags),
      categories: stringArray(entry.categories),
      maxShown,
      enabled: entry.enabled === true,
      audience: stringArray(entry.audience),
      genders: stringArray(entry.genders),
      themes: stringArray(entry.themes),
      styles: stringArray(entry.styles),
    }];
  });
}

export function productsForShopSection(
  products: Product[],
  categories: Category[],
  section: ShopSection,
): Product[] {
  const categorySlugs = section.categories ?? [];
  const audiences = section.audience ?? [];
  const genders = section.genders ?? [];
  const themes = section.themes ?? [];
  const styles = section.styles ?? [];
  const tags = section.tags ?? [];
  const hasFilters = categorySlugs.length + audiences.length + genders.length +
    themes.length + styles.length + tags.length > 0;

  if (!hasFilters) return [];

  let categoryIds: Set<string> | undefined;
  if (categorySlugs.length) {
    categoryIds = new Set(categories.filter(category => categorySlugs.includes(category.slug)).map(category => category.id));
    if (categoryIds.size === 0) return [];
  }

  return products.filter(product => {
    if (categoryIds && !categoryIds.has(product.categoryId)) return false;
    if (audiences.length && !(product.audience ?? []).some(id => audiences.includes(id))) return false;
    if (genders.length && !(product.genders ?? []).some(id => genders.includes(id))) return false;
    if (themes.length && !(product.themes ?? []).some(id => themes.includes(id))) return false;
    if (styles.length && !(product.styles ?? []).some(id => styles.includes(id))) return false;
    if (tags.length && !(product.tagNames ?? []).some(tag =>
      tags.some(sectionTag => sectionTag.toLocaleLowerCase() === tag.toLocaleLowerCase()),
    )) return false;
    return true;
  });
}

export function groupProductsByShopSections(
  products: Product[],
  categories: Category[],
  sections: ShopSection[],
): ShopSectionProductGroup[] {
  const configuredGroups = sections.map(section => ({
    ...section,
    all: productsForShopSection(products, categories, section),
  }));
  const visibleGroups = configuredGroups.filter(section => section.enabled);

  // A product can belong to multiple configured audiences. Only products that
  // match no configured section are added to the fallback; disabled sections
  // therefore remain disabled.
  const configuredProductIds = new Set(configuredGroups.flatMap(section => section.all.map(product => product.id)));
  const unassigned = products.filter(product => !configuredProductIds.has(product.id));
  if (unassigned.length) {
    visibleGroups.push({
      label: "Other Products",
      tag: "other-products",
      tags: [],
      categories: [],
      maxShown: unassigned.length,
      enabled: true,
      all: unassigned,
    });
  }

  return visibleGroups;
}