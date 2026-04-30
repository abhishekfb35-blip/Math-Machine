/**
 * One-time migration: populate product_themes / product_styles junction tables
 * from the themes/styles fields now present in seed-data.json.
 *
 * Run: npx tsx server/scripts/migrate-themes-styles.ts
 */

import { db } from "../db";
import { themes, styles, productThemes, productStyles, products } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import seedData from "../seed-data.json";

type SeedProduct = {
  slug: string;
  themes?: string | null;
  styles?: string | null;
};

async function run() {
  console.log("[migrate] Loading theme/style lookup tables...");

  const allThemes = await db.select({ id: themes.id, name: themes.name }).from(themes);
  const allStyles = await db.select({ id: styles.id, name: styles.name }).from(styles);

  if (allThemes.length === 0) {
    console.error("[migrate] ERROR: No themes found in DB. Run seed first.");
    process.exit(1);
  }
  if (allStyles.length === 0) {
    console.error("[migrate] ERROR: No styles found in DB. Run seed first.");
    process.exit(1);
  }

  const thByName: Record<string, string> = Object.fromEntries(allThemes.map((r) => [r.name, r.id]));
  const stByName: Record<string, string> = Object.fromEntries(allStyles.map((r) => [r.name, r.id]));

  console.log(`[migrate] Themes available: ${allThemes.map((t) => t.name).join(", ")}`);
  console.log(`[migrate] Styles available: ${allStyles.map((s) => s.name).join(", ")}`);

  // Fetch all products from DB indexed by slug
  const dbProds = await db.select({ id: products.id, slug: products.slug }).from(products);
  const slugToId: Record<string, string> = Object.fromEntries(dbProds.map((p) => [p.slug, p.id]));

  // Fetch existing junction rows to avoid duplicate inserts
  const existingThemeRows = await db
    .select({ productId: productThemes.productId, themeId: productThemes.themeId })
    .from(productThemes);
  const existingStyleRows = await db
    .select({ productId: productStyles.productId, styleId: productStyles.styleId })
    .from(productStyles);

  const existingThemeSet = new Set(existingThemeRows.map((r) => `${r.productId}:${r.themeId}`));
  const existingStyleSet = new Set(existingStyleRows.map((r) => `${r.productId}:${r.styleId}`));

  console.log(`[migrate] Existing product_themes rows: ${existingThemeRows.length}`);
  console.log(`[migrate] Existing product_styles rows: ${existingStyleRows.length}`);

  const seedProds = (seedData.products ?? []) as SeedProduct[];

  let themeInserted = 0;
  let styleInserted = 0;
  let themeSkipped = 0;
  let styleSkipped = 0;
  let productsMissingTheme = 0;
  let productsMissingStyle = 0;

  for (const sp of seedProds) {
    const productId = slugToId[sp.slug];
    if (!productId) continue;

    // Themes
    if (sp.themes && typeof sp.themes === "string") {
      const themeNames = sp.themes.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tn of themeNames) {
        const themeId = thByName[tn];
        if (!themeId) {
          console.warn(`[migrate] Unknown theme "${tn}" for product ${sp.slug}`);
          continue;
        }
        const key = `${productId}:${themeId}`;
        if (existingThemeSet.has(key)) {
          themeSkipped++;
        } else {
          await db
            .insert(productThemes)
            .values({ id: createId(), productId, themeId })
            .onConflictDoNothing();
          existingThemeSet.add(key);
          themeInserted++;
        }
      }
    } else {
      productsMissingTheme++;
    }

    // Styles
    if (sp.styles && typeof sp.styles === "string") {
      const styleNames = sp.styles.split(",").map((s) => s.trim()).filter(Boolean);
      for (const sn of styleNames) {
        const styleId = stByName[sn];
        if (!styleId) {
          console.warn(`[migrate] Unknown style "${sn}" for product ${sp.slug}`);
          continue;
        }
        const key = `${productId}:${styleId}`;
        if (existingStyleSet.has(key)) {
          styleSkipped++;
        } else {
          await db
            .insert(productStyles)
            .values({ id: createId(), productId, styleId })
            .onConflictDoNothing();
          existingStyleSet.add(key);
          styleInserted++;
        }
      }
    } else {
      productsMissingStyle++;
    }
  }

  console.log("\n[migrate] ── Results ──────────────────────────────────────────");
  console.log(`[migrate] product_themes: ${themeInserted} inserted, ${themeSkipped} already existed`);
  console.log(`[migrate] product_styles: ${styleInserted} inserted, ${styleSkipped} already existed`);
  console.log(`[migrate] Products without theme: ${productsMissingTheme}`);
  console.log(`[migrate] Products without style: ${productsMissingStyle}`);
  console.log("[migrate] Done.");
}

run().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
