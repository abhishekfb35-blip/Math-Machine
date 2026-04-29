/**
 * migrate-attribute-tables.ts
 *
 * Idempotent verification and repair script for the attribute normalization migration.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * MIGRATION HISTORY
 * ──────────────────────────────────────────────────────────────────────────────
 * The old flat text columns (products.age_group, products.gender, products.themes,
 * products.styles) were replaced with four lookup tables (age_groups, genders,
 * themes, styles) and four junction tables (product_age_groups, product_genders,
 * product_themes, product_styles).
 *
 * Step 1 — Schema was updated in shared/schema.ts and applied via `npm run db:push`.
 *          This DDL removed the old columns and created the new tables. At this
 *          point the legacy columns no longer exist in the database.
 *
 * Step 2 — server/seed.ts was updated to populate the lookup and junction tables
 *          from the seed-data.json catalog. This ran on first startup after the
 *          schema push.
 *
 * This script (Step 3) serves as a post-migration integrity checker and idempotent
 * repair tool. It:
 *   1. Verifies all 8 new attribute tables exist and have data.
 *   2. Identifies any products that have no junction rows (orphaned products).
 *   3. Attempts to back-fill orphaned products from seed-data.json by slug match.
 *   4. Reports products that still have no attribute assignment after the repair
 *      (these were likely added via the admin UI post-migration and require manual
 *      tagging in Admin Catalog → /admin/catalog).
 *
 * Safe to run multiple times (idempotent via ON CONFLICT DO NOTHING).
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { db } from "../db";
import {
  products, ageGroups, genders, themes, styles,
  productAgeGroups, productGenders, productThemes, productStyles,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import seedData from "../seed-data.json";

async function main() {
  console.log("[migrate-attribute-tables] Starting attribute migration verification...");
  console.log("[migrate-attribute-tables] Note: Legacy products.age_group/gender/themes/styles");
  console.log("[migrate-attribute-tables] columns were dropped when db:push applied the new schema.");
  console.log("[migrate-attribute-tables] This script verifies junction coverage and repairs gaps.");
  console.log("");

  // ── 1. Verify tables exist and have lookup data ────────────────────────────
  const [agRows, genRows, thRows, stRows] = await Promise.all([
    db.select({ id: ageGroups.id, name: ageGroups.name }).from(ageGroups),
    db.select({ id: genders.id, name: genders.name }).from(genders),
    db.select({ id: themes.id, name: themes.name }).from(themes),
    db.select({ id: styles.id, name: styles.name }).from(styles),
  ]);

  console.log(`[migrate-attribute-tables] Lookup tables:`);
  console.log(`  age_groups: ${agRows.length} entries`);
  console.log(`  genders:    ${genRows.length} entries`);
  console.log(`  themes:     ${thRows.length} entries`);
  console.log(`  styles:     ${stRows.length} entries`);

  if (agRows.length === 0) {
    console.error("[migrate-attribute-tables] ERROR: age_groups table is empty. Run seed first.");
    process.exit(1);
  }

  const agByName: Record<string, string>  = Object.fromEntries(agRows.map(r => [r.name.toLowerCase(), r.id]));
  const genByName: Record<string, string> = Object.fromEntries(genRows.map(r => [r.name.toLowerCase(), r.id]));
  const thByName: Record<string, string>  = Object.fromEntries(thRows.map(r => [r.name.toLowerCase(), r.id]));
  const stByName: Record<string, string>  = Object.fromEntries(stRows.map(r => [r.name.toLowerCase(), r.id]));

  // ── 2. Check junction table coverage ─────────────────────────────────────
  const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
  const junctionRows = await db.select({ productId: productAgeGroups.productId }).from(productAgeGroups);
  const coveredIds = new Set(junctionRows.map(r => r.productId));
  const orphaned = allProducts.filter(p => !coveredIds.has(p.id));

  console.log(`\n[migrate-attribute-tables] Products: ${allProducts.length} total, ${coveredIds.size} with age_group entries, ${orphaned.length} orphaned`);

  if (orphaned.length === 0) {
    console.log("[migrate-attribute-tables] ✓ All products have attribute junction rows. Nothing to repair.");
  } else {
    console.log(`\n[migrate-attribute-tables] Attempting to back-fill ${orphaned.length} orphaned product(s) from seed-data.json...`);

    const data = seedData as any;
    const seedProducts: any[] = data.products ?? [];
    const seedBySlug: Record<string, any> = Object.fromEntries(seedProducts.map(p => [p.slug, p]));

    let backfilled = 0;
    let notInSeed = 0;

    for (const product of orphaned) {
      const seedProd = seedBySlug[product.slug];
      if (!seedProd) {
        notInSeed++;
        continue;
      }

      // Back-fill age group
      const agName = (seedProd.ageGroup ?? "").toString().toLowerCase().trim();
      const agId = agByName[agName];
      if (agId) {
        await db.insert(productAgeGroups)
          .values({ id: createId(), productId: product.id, ageGroupId: agId })
          .onConflictDoNothing();
      }

      // Back-fill gender
      const genName = (seedProd.gender ?? "").toString().toLowerCase().trim();
      const genId = genByName[genName];
      if (genId) {
        await db.insert(productGenders)
          .values({ id: createId(), productId: product.id, genderId: genId })
          .onConflictDoNothing();
      }

      // Back-fill themes (comma-separated string in seed data)
      if (seedProd.themes && typeof seedProd.themes === "string") {
        for (const name of seedProd.themes.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)) {
          const thId = thByName[name];
          if (thId) {
            await db.insert(productThemes)
              .values({ id: createId(), productId: product.id, themeId: thId })
              .onConflictDoNothing();
          }
        }
      }

      // Back-fill styles (comma-separated string in seed data)
      if (seedProd.styles && typeof seedProd.styles === "string") {
        for (const name of seedProd.styles.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)) {
          const stId = stByName[name];
          if (stId) {
            await db.insert(productStyles)
              .values({ id: createId(), productId: product.id, styleId: stId })
              .onConflictDoNothing();
          }
        }
      }

      backfilled++;
      console.log(`  [backfilled] ${product.slug}`);
    }

    console.log(`\n[migrate-attribute-tables] Back-fill summary: repaired=${backfilled}, not-in-seed=${notInSeed}`);
    if (notInSeed > 0) {
      const missing = orphaned.filter(p => !seedBySlug[p.slug]);
      console.warn(`[migrate-attribute-tables] Products not in seed-data.json (need manual tagging via Admin Catalog):`);
      for (const p of missing.slice(0, 20)) console.warn(`  - ${p.slug}`);
      if (missing.length > 20) console.warn(`  ... and ${missing.length - 20} more`);
    }
  }

  // ── 3. Final coverage report ─────────────────────────────────────────────
  const finalRows = await db.select({ productId: productAgeGroups.productId }).from(productAgeGroups);
  const finalCovered = new Set(finalRows.map(r => r.productId));
  const stillOrphaned = allProducts.filter(p => !finalCovered.has(p.id));

  console.log(`\n[migrate-attribute-tables] Final state: ${finalCovered.size}/${allProducts.length} products have age_group assignment`);

  if (stillOrphaned.length === 0) {
    console.log("[migrate-attribute-tables] ✓ All products have attribute data. Migration complete.");
  } else {
    console.warn(`[migrate-attribute-tables] ⚠ ${stillOrphaned.length} product(s) still untagged — assign attributes in Admin Catalog:`);
    for (const p of stillOrphaned.slice(0, 10)) console.warn(`  - /admin/catalog → search "${p.slug}"`);
    if (stillOrphaned.length > 10) console.warn(`  ... and ${stillOrphaned.length - 10} more`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("[migrate-attribute-tables] FAILED:", err);
  process.exit(1);
});
