import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import {
  categories, products, siteConfig, productImages, productReviews, tags, tagTypes, productTags,
  currencyRates, pricingRules, categoryTagVariantConfigs, variantSizes, variantColors, productVariants,
} from "@shared/schema";
import { and, eq, like } from "drizzle-orm";
import seedData from "./seed-data.json";

const BATCH = 100;

// ─── Hash helpers (stored in site_config as seed-hash-<table>) ───────────────

function computeHash(data: any[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

async function getStoredHash(tableName: string): Promise<string | null> {
  const [row] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, `seed-hash-${tableName}`));
  return row?.value ?? null;
}

async function storeHash(tableName: string, hash: string): Promise<void> {
  const key = `seed-hash-${tableName}`;
  const [existing] = await db
    .select({ key: siteConfig.key })
    .from(siteConfig)
    .where(eq(siteConfig.key, key));
  if (existing) {
    await db.update(siteConfig).set({ value: hash }).where(eq(siteConfig.key, key));
  } else {
    await db.insert(siteConfig).values({ key, value: hash });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedDatabase() {
  try {
    const data = seedData as any;

    // ── 0a. Restore bundled swatch images ─────────────────────────────────────
    // Use process.cwd() (always the project root) so paths work in both dev
    // (tsx) and production (compiled dist) environments.
    const swatchesSrcDir = path.join(process.cwd(), "server/seed-assets/swatches");
    const swatchesDestDir = path.join(process.cwd(), "client/public/images/swatches");

    if (fs.existsSync(swatchesSrcDir)) {
      if (!fs.existsSync(swatchesDestDir)) {
        fs.mkdirSync(swatchesDestDir, { recursive: true });
      }
      const swatchFiles = fs.readdirSync(swatchesSrcDir);
      let swatchesCopied = 0;
      for (const filename of swatchFiles) {
        const destPath = path.join(swatchesDestDir, filename);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(path.join(swatchesSrcDir, filename), destPath);
          swatchesCopied++;
        }
      }
      if (swatchesCopied > 0) {
        console.log(`[seed] swatches: copied ${swatchesCopied} files to public/images/swatches/`);
      } else {
        console.log(`[seed] swatches: all files already present`);
      }
    } else {
      console.log(`[seed] swatches: seed-assets/swatches not found, skipping`);
    }

    const tableData = {
      tagTypes:       (data.tagTypes       || []) as any[],
      categories:     (data.categories     || []) as any[],
      tags:           (data.tags           || []) as any[],
      products:       (data.products       || []) as any[],
      productImages:  (data.productImages  || []) as any[],
      productReviews: (data.productReviews || []) as any[],
      productTags:    (data.productTags    || []) as any[],
    };

    // ── 0. Validate all IDs are present — abort immediately if any are missing ─
    const catalogTableNames = ["tagTypes", "categories", "tags", "products", "productImages", "productReviews", "productTags"] as const;
    let idErrors = 0;
    for (const table of catalogTableNames) {
      const rows: any[] = tableData[table];
      rows.forEach((row, i) => {
        if (!row.id) {
          console.error(`[seed] ERROR: seed-data.json → ${table}[${i}] is missing an "id" field (name/slug: ${row.name || row.slug || row.productSlug || "?"})`);
          idErrors++;
        }
      });
    }
    tableData.products.forEach((p: any, i: number) => {
      if (!p.sku) {
        console.error(`[seed] ERROR: seed-data.json → products[${i}] slug="${p.slug || "?"}" is missing a "sku" field`);
        idErrors++;
      }
    });
    if (idErrors > 0) {
      throw new Error(`[seed] Aborting: ${idErrors} row(s) in seed-data.json are missing "id" or "sku". Re-run the export script to fix.`);
    }

    // ── 1. Check per-table hashes ─────────────────────────────────────────────
    const changed = {
      tagTypes:       computeHash(tableData.tagTypes)       !== await getStoredHash("tagTypes"),
      categories:     computeHash(tableData.categories)     !== await getStoredHash("categories"),
      tags:           computeHash(tableData.tags)           !== await getStoredHash("tags"),
      products:       computeHash(tableData.products)       !== await getStoredHash("products"),
      productImages:  computeHash(tableData.productImages)  !== await getStoredHash("productImages"),
      productReviews: computeHash(tableData.productReviews) !== await getStoredHash("productReviews"),
      productTags:    computeHash(tableData.productTags)    !== await getStoredHash("productTags"),
    };

    // Cascade: if a parent changes, all its children must also be re-seeded
    // (children were wiped when parent was wiped, so they need re-inserting)
    const effective = {
      tagTypes:       changed.tagTypes,
      categories:     changed.categories,
      tags:           changed.tags           || changed.tagTypes,
      products:       changed.products       || changed.categories,
      productImages:  changed.productImages  || changed.products || changed.categories,
      productReviews: changed.productReviews || changed.products || changed.categories,
      productTags:    changed.productTags    || changed.tags     || changed.products || changed.categories,
    };

    const tableNames = Object.keys(effective) as (keyof typeof effective)[];
    const anyChanged = tableNames.some(t => effective[t]);

    for (const name of tableNames) {
      if (effective[name]) {
        const reason = changed[name] ? "hash changed" : "parent changed";
        console.log(`[seed] ${name}: ${reason} → will re-seed`);
      } else {
        console.log(`[seed] ${name}: up to date`);
      }
    }

    if (!anyChanged) {
      console.log("[seed] All catalog tables up to date.");
    } else {
      // ── 2. Wipe in reverse dependency order ─────────────────────────────────
      // Only wipe tables that will be re-inserted. Since children must be wiped
      // before parents (no FK constraints, but logical order), go deepest first.
      if (effective.productTags)    await db.delete(productTags);
      if (changed.productImages)    await db.delete(productImages).where(like(productImages.imageUrl, "/images/products/%"));
      if (effective.productReviews) await db.delete(productReviews);
      if (effective.products)       await db.delete(products);
      if (effective.categories)     await db.delete(categories);
      if (effective.tags)           await db.delete(tags);
      if (effective.tagTypes)       await db.delete(tagTypes);

      // ── 3. Re-insert in dependency order ────────────────────────────────────

      // Tag Types (must come before Tags)
      if (effective.tagTypes) {
        if (tableData.tagTypes.length > 0) {
          await db.insert(tagTypes).values(tableData.tagTypes.map((tt: any) => ({
            id: tt.id,
            name: tt.name,
            slug: tt.slug,
            description: tt.description ?? null,
            sortOrder: tt.sortOrder ?? 0,
          })));
          console.log(`[seed] tagTypes: inserted ${tableData.tagTypes.length}`);
        }
        await storeHash("tagTypes", computeHash(tableData.tagTypes));
      }

      // Categories
      if (effective.categories) {
        if (tableData.categories.length > 0) {
          await db.insert(categories).values(tableData.categories.map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description ?? null,
            imageUrl: c.imageUrl ?? null,
            sortOrder: c.sortOrder ?? 0,
          })));
          console.log(`[seed] categories: inserted ${tableData.categories.length}`);
        }
        await storeHash("categories", computeHash(tableData.categories));
      }

      // Tags (must come after tagTypes due to FK)
      if (effective.tags) {
        if (tableData.tags.length > 0) {
          await db.insert(tags).values(tableData.tags.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description ?? null,
            tagTypeId: t.tagTypeId ?? null,
            sortOrder: t.sortOrder ?? 0,
          })));
          console.log(`[seed] tags: inserted ${tableData.tags.length}`);
        }
        await storeHash("tags", computeHash(tableData.tags));
      }

      // Products (lookup categoryId from live categories by slug)
      if (effective.products) {
        const allCats = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
        const catSlugToId: Record<string, string> = Object.fromEntries(allCats.map(c => [c.slug, c.id]));

        const prodEntries = tableData.products
          .filter((p: any) => catSlugToId[p.categorySlug])
          .map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            slug: p.slug,
            description: p.description ?? null,
            price: p.price,
            mrp: p.mrp ?? null,
            imageUrl: p.imageUrl,
            categoryId: catSlugToId[p.categorySlug],
            amazonAsin: p.amazonAsin ?? null,
            color: p.color ?? null,
            material: p.material ?? null,
            gsm: p.gsm ?? null,
            dimensions: p.dimensions ?? null,
            weightGrams: p.weightGrams ?? null,
            itemsInSet: p.itemsInSet ?? 1,
            specialFeatures: p.specialFeatures ?? null,
            bulletPoints: p.bulletPoints ?? null,
            searchKeywords: p.searchKeywords ?? null,
            productType: p.productType ?? "towel",
            ageGroup: p.ageGroup ?? "kids",
            gender: p.gender ?? "unisex",
            themes: p.themes ?? null,
            styles: p.styles ?? null,
            active: p.active !== false,
            sortOrder: p.sortOrder ?? 0,
          }));

        const skipped = tableData.products.length - prodEntries.length;
        if (skipped > 0) console.warn(`[seed] products: ${skipped} skipped (unknown categorySlug)`);

        for (let i = 0; i < prodEntries.length; i += BATCH) {
          await db.insert(products).values(prodEntries.slice(i, i + BATCH));
        }
        console.log(`[seed] products: inserted ${prodEntries.length}`);
        await storeHash("products", computeHash(tableData.products));
      }

      // ProductImages (lookup productId by slug)
      if (effective.productImages) {
        if (tableData.productImages.length > 0) {
          const allProds = await db.select({ id: products.id, slug: products.slug }).from(products);
          const prodSlugToId: Record<string, string> = Object.fromEntries(allProds.map(p => [p.slug, p.id]));

          const imgEntries = tableData.productImages
            .filter((img: any) => prodSlugToId[img.productSlug])
            .map((img: any) => ({
              id: img.id,
              productId: prodSlugToId[img.productSlug],
              imageUrl: img.imageUrl,
              sortOrder: img.sortOrder ?? 0,
              isPrimary: img.isPrimary ?? false,
            }));

          for (let i = 0; i < imgEntries.length; i += BATCH) {
            await db.insert(productImages).values(imgEntries.slice(i, i + BATCH)).onConflictDoNothing();
          }
          console.log(`[seed] productImages: inserted ${imgEntries.length}`);
        }
        await storeHash("productImages", computeHash(tableData.productImages));
      }

      // ProductReviews (lookup productId by slug)
      if (effective.productReviews) {
        if (tableData.productReviews.length > 0) {
          const allProds = await db.select({ id: products.id, slug: products.slug }).from(products);
          const prodSlugToId: Record<string, string> = Object.fromEntries(allProds.map(p => [p.slug, p.id]));

          const revEntries = tableData.productReviews
            .filter((r: any) => prodSlugToId[r.productSlug])
            .map((r: any) => ({
              id: r.id,
              productId: prodSlugToId[r.productSlug],
              reviewerName: r.reviewerName,
              rating: r.rating,
              title: r.title ?? null,
              body: r.body ?? null,
              amzReviewDate: r.amzReviewDate ?? null,
              verifiedPurchase: r.verifiedPurchase ?? false,
            }));

          const skipped = tableData.productReviews.length - revEntries.length;
          if (skipped > 0) console.warn(`[seed] productReviews: ${skipped} skipped (unknown productSlug)`);

          for (let i = 0; i < revEntries.length; i += BATCH) {
            await db.insert(productReviews).values(revEntries.slice(i, i + BATCH));
          }
          console.log(`[seed] productReviews: inserted ${revEntries.length}`);
        }
        await storeHash("productReviews", computeHash(tableData.productReviews));
      }

      // ProductTags (lookup productId + tagId by slug/name)
      if (effective.productTags) {
        if (tableData.productTags.length > 0) {
          const allProds = await db.select({ id: products.id, slug: products.slug }).from(products);
          const allTagsList = await db.select({ id: tags.id, name: tags.name }).from(tags);
          const prodSlugToId: Record<string, string> = Object.fromEntries(allProds.map(p => [p.slug, p.id]));
          const tagNameToId: Record<string, string> = Object.fromEntries(allTagsList.map(t => [t.name, t.id]));

          const ptEntries = tableData.productTags
            .filter((pt: any) => prodSlugToId[pt.productSlug] && tagNameToId[pt.tagName])
            .map((pt: any) => ({
              id: pt.id,
              productId: prodSlugToId[pt.productSlug],
              tagId: tagNameToId[pt.tagName],
            }));

          if (ptEntries.length > 0) {
            await db.insert(productTags).values(ptEntries);
            console.log(`[seed] productTags: inserted ${ptEntries.length}`);
          }
        }
        await storeHash("productTags", computeHash(tableData.productTags));
      }
    }

    // ── 4. siteConfig: row-level upsert, skip seed-hash-* keys ───────────────
    const configEntries: any[] = (data.siteConfig || []).filter((sc: any) => !sc.key.startsWith("seed-hash-"));
    let configSynced = 0;
    for (const sc of configEntries) {
      const [existing] = await db.select().from(siteConfig).where(eq(siteConfig.key, sc.key));
      if (!existing) {
        await db.insert(siteConfig).values({ key: sc.key, value: sc.value });
        configSynced++;
      } else if (existing.value !== sc.value) {
        await db.update(siteConfig).set({ value: sc.value }).where(eq(siteConfig.key, sc.key));
        configSynced++;
      }
    }
    if (configSynced > 0) {
      console.log(`[seed] siteConfig: synced ${configSynced} entries`);
    } else {
      console.log(`[seed] siteConfig: all entries up to date`);
    }

    // ── 5. currencyRates: upsert by currency ──────────────────────────────────
    const crEntries: any[] = (data.currencyRates || []);
    let crSynced = 0;
    for (const cr of crEntries) {
      const [existing] = await db.select().from(currencyRates).where(eq(currencyRates.currency, cr.currency));
      if (!existing) {
        await db.insert(currencyRates).values({ id: cr.id, currency: cr.currency, rateFromInr: cr.rateFromInr });
        crSynced++;
      } else if (String(existing.rateFromInr) !== String(cr.rateFromInr)) {
        await db.update(currencyRates).set({ rateFromInr: cr.rateFromInr }).where(eq(currencyRates.currency, cr.currency));
        crSynced++;
      }
    }
    if (crSynced > 0) {
      console.log(`[seed] currencyRates: synced ${crSynced} entries`);
    } else {
      console.log(`[seed] currencyRates: all entries up to date`);
    }

    // ── 5a. pricingRules: upsert by currency ──────────────────────────────────
    const prEntries: any[] = (data.pricingRules || []);
    let prSynced = 0;
    for (const pr of prEntries) {
      const [existing] = await db.select().from(pricingRules).where(eq(pricingRules.currency, pr.currency));
      if (!existing) {
        await db.insert(pricingRules).values({
          id: pr.id,
          currency: pr.currency,
          symbol: pr.symbol,
          displayName: pr.displayName ?? null,
          markupPercent: pr.markupPercent ?? "0",
          roundingRule: pr.roundingRule ?? "nearest",
          enabled: pr.enabled !== false,
        });
        prSynced++;
      } else {
        const changed =
          existing.symbol !== pr.symbol ||
          existing.displayName !== (pr.displayName ?? null) ||
          String(existing.markupPercent) !== String(pr.markupPercent ?? "0") ||
          existing.roundingRule !== (pr.roundingRule ?? "nearest") ||
          existing.enabled !== (pr.enabled !== false);
        if (changed) {
          await db.update(pricingRules).set({
            symbol: pr.symbol,
            displayName: pr.displayName ?? null,
            markupPercent: pr.markupPercent ?? "0",
            roundingRule: pr.roundingRule ?? "nearest",
            enabled: pr.enabled !== false,
          }).where(eq(pricingRules.currency, pr.currency));
          prSynced++;
        }
      }
    }
    if (prSynced > 0) {
      console.log(`[seed] pricingRules: synced ${prSynced} entries`);
    } else {
      console.log(`[seed] pricingRules: all entries up to date`);
    }

    // ── 6. categoryTagVariantConfigs: upsert by (categoryId, tagId) ──────────
    const allCatsForVariants = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
    const catSlugToIdV: Record<string, string> = Object.fromEntries(allCatsForVariants.map(c => [c.slug, c.id]));
    const ctvcEntries: any[] = (data.categoryTagVariantConfigs || []);
    let ctvcSynced = 0;
    // Map seed configId → actual DB configId (in case the DB has a different PK)
    const seedConfigIdToDbId: Record<string, string> = {};
    for (const ctvc of ctvcEntries) {
      const catId = catSlugToIdV[ctvc.categorySlug];
      if (!catId) { console.warn(`[seed] categoryTagVariantConfigs: unknown categorySlug "${ctvc.categorySlug}"`); continue; }
      const tagId = ctvc.tagId ?? null;
      const whereClause = tagId
        ? and(eq(categoryTagVariantConfigs.categoryId, catId), eq(categoryTagVariantConfigs.tagId, tagId))
        : and(eq(categoryTagVariantConfigs.categoryId, catId));
      const [existing] = await db.select().from(categoryTagVariantConfigs).where(whereClause);
      if (!existing) {
        await db.insert(categoryTagVariantConfigs).values({ id: ctvc.id, categoryId: catId, tagId, sortOrder: ctvc.sortOrder ?? 0 });
        seedConfigIdToDbId[ctvc.id] = ctvc.id;
        ctvcSynced++;
      } else {
        seedConfigIdToDbId[ctvc.id] = existing.id;
        if (existing.sortOrder !== (ctvc.sortOrder ?? 0)) {
          await db.update(categoryTagVariantConfigs).set({ sortOrder: ctvc.sortOrder ?? 0 }).where(eq(categoryTagVariantConfigs.id, existing.id));
          ctvcSynced++;
        }
      }
    }
    if (ctvcSynced > 0) {
      console.log(`[seed] categoryTagVariantConfigs: synced ${ctvcSynced}`);
    } else {
      console.log(`[seed] categoryTagVariantConfigs: all entries up to date`);
    }

    // ── 7. variantSizes: upsert by (configId, name) ───────────────────────────
    const vsEntries: any[] = (data.variantSizes || []);
    let vsSynced = 0;
    // Map seed sizeId → actual DB sizeId (in case the DB has a different PK)
    const seedSizeIdToDbId: Record<string, string> = {};
    for (const vs of vsEntries) {
      // Resolve actual DB configId (may differ from seed configId if row pre-existed)
      const actualConfigId = seedConfigIdToDbId[vs.configId] ?? vs.configId;
      const [existing] = await db.select().from(variantSizes)
        .where(and(eq(variantSizes.configId, actualConfigId), eq(variantSizes.name, vs.name)));
      if (!existing) {
        await db.insert(variantSizes).values({
          id: vs.id, configId: actualConfigId, name: vs.name,
          description: vs.description ?? null, descriptionFontSize: vs.descriptionFontSize ?? 12,
          priceAdd: vs.priceAdd ?? 0, isDefault: vs.isDefault ?? false,
          blurOnFront: vs.blurOnFront ?? false, sortOrder: vs.sortOrder ?? 0,
        });
        seedSizeIdToDbId[vs.id] = vs.id;
        vsSynced++;
      } else {
        seedSizeIdToDbId[vs.id] = existing.id;
        const changed =
          existing.description !== (vs.description ?? null) ||
          existing.descriptionFontSize !== (vs.descriptionFontSize ?? 12) ||
          existing.priceAdd !== (vs.priceAdd ?? 0) ||
          existing.isDefault !== (vs.isDefault ?? false) ||
          existing.blurOnFront !== (vs.blurOnFront ?? false) ||
          existing.sortOrder !== (vs.sortOrder ?? 0);
        if (changed) {
          await db.update(variantSizes).set({
            description: vs.description ?? null, descriptionFontSize: vs.descriptionFontSize ?? 12,
            priceAdd: vs.priceAdd ?? 0, isDefault: vs.isDefault ?? false,
            blurOnFront: vs.blurOnFront ?? false, sortOrder: vs.sortOrder ?? 0,
          }).where(eq(variantSizes.id, existing.id));
          vsSynced++;
        }
      }
    }
    if (vsSynced > 0) {
      console.log(`[seed] variantSizes: synced ${vsSynced}`);
    } else {
      console.log(`[seed] variantSizes: all entries up to date`);
    }

    // ── 8. variantColors: upsert by (sizeId, name) ───────────────────────────
    const vcEntries: any[] = (data.variantColors || []);
    let vcSynced = 0;
    for (const vc of vcEntries) {
      // Resolve actual DB sizeId (may differ from seed sizeId if row pre-existed)
      const actualSizeId = seedSizeIdToDbId[vc.sizeId] ?? vc.sizeId;
      const [existing] = await db.select().from(variantColors)
        .where(and(eq(variantColors.sizeId, actualSizeId), eq(variantColors.name, vc.name)));
      if (!existing) {
        await db.insert(variantColors).values({
          id: vc.id, sizeId: actualSizeId, name: vc.name,
          swatchUrl: vc.swatchUrl ?? null, blurOnFront: vc.blurOnFront ?? false, sortOrder: vc.sortOrder ?? 0,
        });
        vcSynced++;
      } else {
        const changed =
          existing.swatchUrl !== (vc.swatchUrl ?? null) ||
          existing.blurOnFront !== (vc.blurOnFront ?? false) ||
          existing.sortOrder !== (vc.sortOrder ?? 0);
        if (changed) {
          await db.update(variantColors).set({
            swatchUrl: vc.swatchUrl ?? null, blurOnFront: vc.blurOnFront ?? false, sortOrder: vc.sortOrder ?? 0,
          }).where(eq(variantColors.id, existing.id));
          vcSynced++;
        }
      }
    }
    if (vcSynced > 0) {
      console.log(`[seed] variantColors: synced ${vcSynced}`);
    } else {
      console.log(`[seed] variantColors: all entries up to date`);
    }

    // ── 9. productVariants: upsert by (productId, color, size) ───────────────
    const allProdsForVariants = await db.select({ id: products.id, slug: products.slug }).from(products);
    const prodSlugToIdV: Record<string, string> = Object.fromEntries(allProdsForVariants.map(p => [p.slug, p.id]));
    const pvEntries: any[] = (data.productVariants || []);
    let pvSynced = 0;
    for (const pv of pvEntries) {
      const productId = prodSlugToIdV[pv.productSlug];
      if (!productId) { console.warn(`[seed] productVariants: unknown productSlug "${pv.productSlug}"`); continue; }
      const [existing] = await db.select().from(productVariants)
        .where(and(eq(productVariants.productId, productId), eq(productVariants.color, pv.color), eq(productVariants.size, pv.size)));
      if (!existing) {
        await db.insert(productVariants).values({ id: pv.id, productId, color: pv.color, size: pv.size, available: pv.available ?? true });
        pvSynced++;
      } else if (existing.available !== (pv.available ?? true)) {
        await db.update(productVariants).set({ available: pv.available ?? true }).where(eq(productVariants.id, existing.id));
        pvSynced++;
      }
    }
    if (pvSynced > 0) {
      console.log(`[seed] productVariants: synced ${pvSynced}`);
    } else {
      console.log(`[seed] productVariants: all entries up to date`);
    }

    // ── 10. Default shop-sections config (first-time seed only) ──────────────
    const [existingShopSections] = await db
      .select({ key: siteConfig.key })
      .from(siteConfig)
      .where(eq(siteConfig.key, "shop-sections"));
    if (!existingShopSections) {
      const defaultSections = JSON.stringify([
        { label: "Kids Towels",      tag: "kids towels",      maxShown: 8, enabled: true },
        { label: "Adult Towels",     tag: "adult towels",     maxShown: 8, enabled: true },
        { label: "Couple Towels",    tag: "couple towels",    maxShown: 8, enabled: true },
        { label: "Kids Blankets",    tag: "kids blankets",    maxShown: 8, enabled: true },
        { label: "Kids Bathrobes",   tag: "kids bathrobes",   maxShown: 8, enabled: true },
        { label: "Adult Bathrobes",  tag: "adult bathrobes",  maxShown: 8, enabled: true },
        { label: "Couple Bathrobes", tag: "couple bathrobes", maxShown: 8, enabled: true },
      ]);
      await db.insert(siteConfig).values({ key: "shop-sections", value: defaultSections });
      console.log("[seed] shop-sections: inserted default 7 sections");
    } else {
      console.log("[seed] shop-sections: already present, skipping");
    }

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
