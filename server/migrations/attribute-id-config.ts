import { db } from "../db";
import {
  audience,
  genders,
  themes,
  styles,
  occasions,
  siteContent,
} from "@shared/schema";
import { eq } from "drizzle-orm";

type Attribute = { id: string; name: string };

function makeResolver(rows: Attribute[], label: string) {
  const byId = new Set(rows.map(row => row.id));
  const byName = new Map(rows.map(row => [row.name.trim().toLowerCase(), row.id]));

  return (value: string): string => {
    const trimmed = value.trim();
    if (byId.has(trimmed)) return trimmed;
    const id = byName.get(trimmed.toLowerCase());
    if (!id) throw new Error(`[migration] attribute-id-config: unresolved ${label} value "${value}"`);
    return id;
  };
}

function migrateCsv(value: string | null, resolve: (value: string) => string): string | null {
  if (!value) return value;
  return value.split(",").map(value => value.trim()).filter(Boolean).map(resolve).join(",");
}

function migrateFilterObject(
  value: any,
  resolvers: {
    audience: (value: string) => string;
    gender: (value: string) => string;
    theme: (value: string) => string;
    style: (value: string) => string;
  },
) {
  if (!value || typeof value !== "object") return value;
  const fieldResolvers: Record<string, (value: string) => string> = {
    audience: resolvers.audience,
    genders: resolvers.gender,
    themes: resolvers.theme,
    styles: resolvers.style,
    audienceFilters: resolvers.audience,
    genderFilters: resolvers.gender,
    themeFilters: resolvers.theme,
    styleFilters: resolvers.style,
  };

  const migrateOne = (item: any) => {
    if (!item || typeof item !== "object") return item;
    for (const [field, resolve] of Object.entries(fieldResolvers)) {
      if (Array.isArray(item[field])) item[field] = item[field].map((entry: unknown) => resolve(String(entry)));
    }
    return item;
  };

  if (Array.isArray(value)) return value.map(migrateOne);
  const directFilterObject = Object.keys(fieldResolvers).some(field => Array.isArray(value[field]));
  if (directFilterObject) return migrateOne({ ...value });
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      item && typeof item === "object" ? migrateOne({ ...(item as any) }) : item,
    ]),
  );
}

async function migrateSiteContentConfig(
  key: string,
  transform: (value: any) => any,
): Promise<void> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, key));
  if (!row) return;

  const parsed = JSON.parse(row.value);
  const migrated = transform(parsed);
  const serialized = JSON.stringify(migrated);
  if (serialized !== row.value) {
    await db.update(siteContent).set({ value: serialized }).where(eq(siteContent.key, key));
  }
}

export async function ensureAttributeIdConfig(): Promise<void> {
  const [audienceRows, genderRows, themeRows, styleRows] = await Promise.all([
    db.select({ id: audience.id, name: audience.name }).from(audience),
    db.select({ id: genders.id, name: genders.name }).from(genders),
    db.select({ id: themes.id, name: themes.name }).from(themes),
    db.select({ id: styles.id, name: styles.name }).from(styles),
  ]);

  const resolvers = {
    audience: makeResolver(audienceRows, "audience"),
    gender: makeResolver(genderRows, "gender"),
    theme: makeResolver(themeRows, "theme"),
    style: makeResolver(styleRows, "style"),
  };

  await migrateSiteContentConfig("product-page-config", value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const result: Record<string, unknown> = {};
    for (const [key, config] of Object.entries(value)) {
      const audienceId = resolvers.audience(key);
      result[audienceId] = config;
    }
    return result;
  });

  await migrateSiteContentConfig("shop-sections", value => migrateFilterObject(value, resolvers));
  await migrateSiteContentConfig("featuredSections", value => migrateFilterObject(value, resolvers));

  const occasionRows = await db.select({
    id: occasions.id,
    preferredThemes: occasions.preferredThemes,
    preferredStyles: occasions.preferredStyles,
  }).from(occasions);
  for (const occasion of occasionRows) {
    const preferredThemes = migrateCsv(occasion.preferredThemes, resolvers.theme);
    const preferredStyles = migrateCsv(occasion.preferredStyles, resolvers.style);
    if (preferredThemes !== occasion.preferredThemes || preferredStyles !== occasion.preferredStyles) {
      await db.update(occasions)
        .set({ preferredThemes, preferredStyles })
        .where(eq(occasions.id, occasion.id));
    }
  }

  console.log("[migration] attribute-id-config: attribute relation configs use IDs");
}