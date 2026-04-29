/**
 * migrate-attribute-tables.ts
 *
 * Idempotent migration/verification script for the attribute normalization work.
 *
 * Background: The old `age_group`, `gender`, `themes`, `styles` text columns on
 * `products` were replaced with four lookup tables (age_groups, genders, themes,
 * styles) and four junction tables (product_age_groups, product_genders,
 * product_themes, product_styles). Data was initially populated from seed-data.json
 * during seeding. This script:
 *
 *  1. Verifies all eight new tables exist.
 *  2. For products WITHOUT any junction entries, attempts to back-fill from
 *     seed-data.json (the source of truth for pre-existing catalog data).
 *  3. Reports products that still have no attribute data (likely admin-created
 *     products that need manual tagging via the Admin Catalog UI).
 *
 * Safe to run multiple times (idempotent — uses ON CONFLICT DO NOTHING).
 */

import { db } from "../db";
import {
  products, ageGroups, genders, themes, styles,
  productAgeGroups, productGenders, productThemes, productStyles,
} from "@shared/schema";
import { eq, notInArray, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import seedData from "../seed-data.json";

async function main() {
  console.log("[migrate-attribute-tables] Starting...");

  // ── 1. Verify tables exist ────────────────────────────────────────────────
  const tableChecks = await Promise.all([
    db.select({ id: ageGroups.id }).from(ageGroups).limit(1),
    db.select({ id: genders.id }).from(genders).limit(1),
    db.select({ id: themes.id }).from(themes).limit(1),
    db.select({ id: styles.id }).from(styles).limit(1),
    db.select({ id: productAgeGroups.id }).from(productAgeGroups).limit(1),
    db.select({ id: productGenders.id }).from(productGenders).limit(1),
    db.select({ id: productThemes.id }).from(productThemes).limit(1),
    db.select({ id: productStyles.id }).from(productStyles).limit(1),
  ]);
  console.log("[migrate-attribute-tables] All 8 attribute tables exist ✓");

  // ── 2. Load lookup maps ──────────────────────────────────────────────────
  const agRows = await db.select({ id: ageGroups.id, name: ageGroups.name }).from(ageGroups);
  const genRows = await db.select({ id: genders.id, name: genders.name }).from(genders);
  const thRows  = await db.select({ id: themes.id, name: themes.name }).from(themes);
  const stRows  = await db.select({ id: styles.id, name: styles.name }).from(styles);

  const agByName: Record<string, string>  = Object.fromEntries(agRows.map(r => [r.name, r.id]));
  const genByName: Record<string, string> = Object.fromEntries(genRows.map(r => [r.name, r.id]));
  const thByName: Record<string, string>  = Object.fromEntries(thRows.map(r => [r.name, r.id]));
  const stByName: Record<string, string>  = Object.fromEntries(stRows.map(r => [r.name, r.id]));

  console.log(`[migrate-attribute-tables] Lookup counts: age_groups=${agRows.length}, genders=${genRows.length}, themes=${thRows.length}, styles=${stRows.length}`);

  // ── 3. Find products with no junction entries ─────────────────────────────
  const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);

  const productsWithAg = await db.select({ productId: productAgeGroups.productId }).from(productAgeGroups);
  const coveredByAg = new Set(productsWithAg.map(r => r.productId));

  const uncoveredProducts = allProducts.filter(p => !coveredByAg.has(p.id));
  console.log(`[migrate-attribute-tables] Products total: ${allProducts.length}, with age_group entry: ${coveredByAg.size}, without: ${uncoveredProducts.length}`);

  if (uncoveredProducts.length === 0) {
    console.log("[migrate-attribute-tables] All products already have attribute junction rows. Nothing to migrate.");
  } else {
    // ── 4. Back-fill from seed-data.json ────────────────────────────────────
    const data = seedData as any;
    const seedProducts: any[] = data.products ?? [];
    const seedBySlug: Record<string, any> = Object.fromEntries(seedProducts.map(p => [p.slug, p]));

    let backfilled = 0;
    let skipped = 0;

    for (const product of uncoveredProducts) {
      const seedProd = seedBySlug[product.slug];
      if (!seedProd) {
        skipped++;
        continue;
      }

      const agId = seedProd.ageGroup ? agByName[seedProd.ageGroup] : undefined;
      const genId = seedProd.gender  ? genByName[seedProd.gender]  : undefined;

      if (agId) {
        await db.insert(productAgeGroups)
          .values({ id: createId(), productId: product.id, ageGroupId: agId })
          .onConflictDoNothing();
      }
      if (genId) {
        await db.insert(productGenders)
          .values({ id: createId(), productId: product.id, genderId: genId })
          .onConflictDoNothing();
      }

      if (seedProd.themes && typeof seedProd.themes === "string") {
        for (const name of seedProd.themes.split(",").map((s: string) => s.trim()).filter(Boolean)) {
          const thId = thByName[name];
          if (thId) {
            await db.insert(productThemes)
              .values({ id: createId(), productId: product.id, themeId: thId })
              .onConflictDoNothing();
          }
        }
      }
      if (seedProd.styles && typeof seedProd.styles === "string") {
        for (const name of seedProd.styles.split(",").map((s: string) => s.trim()).filter(Boolean)) {
          const stId = stByName[name];
          if (stId) {
            await db.insert(productStyles)
              .values({ id: createId(), productId: product.id, styleId: stId })
              .onConflictDoNothing();
          }
        }
      }

      backfilled++;
    }

    console.log(`[migrate-attribute-tables] Back-filled: ${backfilled}, no seed match (needs manual tagging): ${skipped}`);
  }

  // ── 5. Final coverage report ─────────────────────────────────────────────
  const finalWithAg = await db.select({ productId: productAgeGroups.productId }).from(productAgeGroups);
  const finalCoveredIds = new Set(finalWithAg.map(r => r.productId));
  const stillUncovered = allProducts.filter(p => !finalCoveredIds.has(p.id));

  if (stillUncovered.length > 0) {
    console.warn(`[migrate-attribute-tables] ${stillUncovered.length} product(s) still have no age group — tag them in Admin Catalog:`);
    for (const p of stillUncovered.slice(0, 10)) {
      console.warn(`  - ${p.slug}`);
    }
    if (stillUncovered.length > 10) console.warn(`  ... and ${stillUncovered.length - 10} more`);
  } else {
    console.log("[migrate-attribute-tables] All products now have at least one age group junction row ✓");
  }

  console.log("[migrate-attribute-tables] Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("[migrate-attribute-tables] FAILED:", err);
  process.exit(1);
});
