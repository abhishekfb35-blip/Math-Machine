/**
 * migrate-attribute-tables.ts
 *
 * Idempotent migration script for normalizing product attribute columns.
 *
 * WHAT THIS DOES
 * ──────────────
 * Replaces the flat text columns on `products`
 *   (age_group, gender, themes, styles)
 * with four normalized lookup + junction tables
 *   (age_groups, genders, themes, styles, product_age_groups,
 *    product_genders, product_themes, product_styles).
 *
 * The script runs in two modes automatically:
 *
 *  MODE A — Legacy columns still exist:
 *    1. Reads age_group/gender/themes/styles from each products row.
 *    2. Resolves values against the lookup tables.
 *    3. Inserts junction rows (ON CONFLICT DO NOTHING).
 *    4. Drops the legacy columns after successful transfer.
 *
 *  MODE B — Legacy columns already dropped (e.g. db:push already ran):
 *    1. Identifies products with no junction rows.
 *    2. Back-fills from seed-data.json by slug match.
 *    3. Reports products still without attributes (manual Admin Catalog action needed).
 *
 * PRODUCTION RUNBOOK (MODE B check)
 * ───────────────────────────────────
 * After running this script, review the "Coverage after migration" output block
 * at the end of the log. For each junction table (age_groups, genders, themes,
 * styles) it prints the count of products assigned. Any products not covered will
 * be listed under "Products still missing age_group junction rows" — these need
 * manual assignment via Admin Catalog → product edit → Attributes tab before
 * those products appear correctly in Shop/Collection filtering.
 *
 * Safe to run multiple times (fully idempotent).
 */

import { db } from "../db";
import {
  products, ageGroups, genders, themes, styles,
  productAgeGroups, productGenders, productThemes, productStyles,
} from "@shared/schema";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import seedData from "../seed-data.json";

// ── helpers ──────────────────────────────────────────────────────────────────

async function legacyColumnsExist(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name IN ('age_group', 'gender', 'themes', 'styles')
  `);
  const rows = result.rows as Array<{ cnt: string | number }>;
  return Number(rows[0]?.cnt ?? 0) === 4;
}

async function loadLookupMaps() {
  const [agRows, genRows, thRows, stRows] = await Promise.all([
    db.select({ id: ageGroups.id, name: ageGroups.name }).from(ageGroups),
    db.select({ id: genders.id, name: genders.name }).from(genders),
    db.select({ id: themes.id, name: themes.name }).from(themes),
    db.select({ id: styles.id, name: styles.name }).from(styles),
  ]);
  return {
    agByName:  Object.fromEntries(agRows.map(r => [r.name.toLowerCase(), r.id])) as Record<string,string>,
    genByName: Object.fromEntries(genRows.map(r => [r.name.toLowerCase(), r.id])) as Record<string,string>,
    thByName:  Object.fromEntries(thRows.map(r => [r.name.toLowerCase(), r.id])) as Record<string,string>,
    stByName:  Object.fromEntries(stRows.map(r => [r.name.toLowerCase(), r.id])) as Record<string,string>,
    agCount: agRows.length, genCount: genRows.length, thCount: thRows.length, stCount: stRows.length,
  };
}

async function insertJunctions(
  productId: string,
  ageGroup: string | null,
  gender: string | null,
  themesVal: string | null,
  stylesVal: string | null,
  maps: Awaited<ReturnType<typeof loadLookupMaps>>,
) {
  const { agByName, genByName, thByName, stByName } = maps;

  if (ageGroup) {
    const agId = agByName[ageGroup.toLowerCase().trim()];
    if (agId) await db.insert(productAgeGroups).values({ id: createId(), productId, ageGroupId: agId }).onConflictDoNothing();
  }
  if (gender) {
    const genId = genByName[gender.toLowerCase().trim()];
    if (genId) await db.insert(productGenders).values({ id: createId(), productId, genderId: genId }).onConflictDoNothing();
  }
  if (themesVal) {
    for (const name of themesVal.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)) {
      const thId = thByName[name];
      if (thId) await db.insert(productThemes).values({ id: createId(), productId, themeId: thId }).onConflictDoNothing();
    }
  }
  if (stylesVal) {
    for (const name of stylesVal.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)) {
      const stId = stByName[name];
      if (stId) await db.insert(productStyles).values({ id: createId(), productId, styleId: stId }).onConflictDoNothing();
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[migrate-attribute-tables] Starting...");

  const maps = await loadLookupMaps();
  const emptyTables: string[] = [];
  if (maps.agCount === 0) emptyTables.push("age_groups");
  if (maps.genCount === 0) emptyTables.push("genders");
  if (maps.thCount === 0) emptyTables.push("themes");
  if (maps.stCount === 0) emptyTables.push("styles");
  if (emptyTables.length > 0) {
    console.error(`[migrate-attribute-tables] ERROR: lookup table(s) empty: ${emptyTables.join(", ")} — run seed first (npm run dev)`);
    process.exit(1);
  }
  console.log(`[migrate-attribute-tables] Lookup: age_groups=${maps.agCount} genders=${maps.genCount} themes=${maps.thCount} styles=${maps.stCount}`);

  const hasLegacy = await legacyColumnsExist();
  console.log(`[migrate-attribute-tables] Legacy columns present: ${hasLegacy}`);

  if (hasLegacy) {
    // ── MODE A: read legacy columns, populate junctions, drop columns ────────
    console.log("[migrate-attribute-tables] MODE A: migrating from legacy text columns");

    const rows = await db.execute(sql`
      SELECT id, age_group, gender, themes, styles FROM products
    `);
    const allProducts = rows.rows as Array<{
      id: string; age_group: string | null; gender: string | null;
      themes: string | null; styles: string | null;
    }>;

    let migrated = 0;
    let skipped  = 0;
    for (const p of allProducts) {
      if (!p.age_group && !p.gender && !p.themes && !p.styles) { skipped++; continue; }
      await insertJunctions(p.id, p.age_group, p.gender, p.themes, p.styles, maps);
      migrated++;
    }
    console.log(`[migrate-attribute-tables] Junction rows inserted for ${migrated} products (${skipped} had no legacy data)`);

    // Drop legacy columns
    await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS age_group`);
    await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS gender`);
    await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS themes`);
    await db.execute(sql`ALTER TABLE products DROP COLUMN IF EXISTS styles`);
    console.log("[migrate-attribute-tables] ✓ Legacy columns dropped");

  } else {
    // ── MODE B: legacy columns already gone, verify + repair coverage ────────
    console.log("[migrate-attribute-tables] MODE B: legacy columns absent — verifying junction coverage");

    const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
    const junctionRows = await db.select({ productId: productAgeGroups.productId }).from(productAgeGroups);
    const coveredIds = new Set(junctionRows.map(r => r.productId));
    const orphaned = allProducts.filter(p => !coveredIds.has(p.id));

    console.log(`[migrate-attribute-tables] Products: ${allProducts.length} total, ${coveredIds.size} covered, ${orphaned.length} orphaned`);

    if (orphaned.length > 0) {
      type SeedProduct = { slug: string; ageGroup?: string; age_group?: string; gender?: string; themes?: string; styles?: string };
      const seedProds = ((seedData as unknown as { products?: SeedProduct[] }).products ?? []);
      const seedBySlug: Record<string, SeedProduct> = Object.fromEntries(seedProds.map(p => [p.slug, p]));
      let backfilled = 0;
      let notInSeed  = 0;

      for (const p of orphaned) {
        const sp = seedBySlug[p.slug];
        if (!sp) { notInSeed++; continue; }
        await insertJunctions(p.id, sp.ageGroup ?? sp.age_group ?? null, sp.gender ?? null, sp.themes ?? null, sp.styles ?? null, maps);
        backfilled++;
      }
      console.log(`[migrate-attribute-tables] Back-fill: repaired=${backfilled} not-in-seed=${notInSeed}`);

      if (notInSeed > 0) {
        const missing = orphaned.filter(p => !seedBySlug[p.slug]);
        console.warn("[migrate-attribute-tables] Products needing manual tagging via Admin Catalog:");
        for (const p of missing.slice(0, 20)) console.warn(`  - ${p.slug}`);
        if (missing.length > 20) console.warn(`  ... and ${missing.length - 20} more`);
      }
    }
  }

  // ── Final coverage report (all 4 junction tables) ───────────────────────
  const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
  const [finalAg, finalGen, finalTheme, finalStyle] = await Promise.all([
    db.select({ productId: productAgeGroups.productId }).from(productAgeGroups),
    db.select({ productId: productGenders.productId }).from(productGenders),
    db.select({ productId: productThemes.productId }).from(productThemes),
    db.select({ productId: productStyles.productId }).from(productStyles),
  ]);
  const coveredAg    = new Set(finalAg.map(r => r.productId));
  const coveredGen   = new Set(finalGen.map(r => r.productId));
  const coveredTheme = new Set(finalTheme.map(r => r.productId));
  const coveredStyle = new Set(finalStyle.map(r => r.productId));

  const total = allProducts.length;
  console.log(`\n[migrate-attribute-tables] Final coverage (${total} products total):`);
  console.log(`  age_groups : ${coveredAg.size}/${total}`);
  console.log(`  genders    : ${coveredGen.size}/${total}`);
  console.log(`  themes     : ${coveredTheme.size}/${total}`);
  console.log(`  styles     : ${coveredStyle.size}/${total}`);

  const untaggedAg = allProducts.filter(p => !coveredAg.has(p.id));
  if (untaggedAg.length === 0) {
    console.log("[migrate-attribute-tables] ✓ All products have age_group assignment. Migration complete.");
  } else {
    console.warn(`[migrate-attribute-tables] ⚠ ${untaggedAg.length} product(s) missing age_group — use Admin Catalog to assign`);
    for (const p of untaggedAg.slice(0, 10)) console.warn(`  - ${p.slug}`);
    if (untaggedAg.length > 10) console.warn(`  ... and ${untaggedAg.length - 10} more`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("[migrate-attribute-tables] FAILED:", err);
  process.exit(1);
});
