import crypto from "crypto";
import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import { categories, products, siteConfig, productImages, productReviews, tags, productTags } from "@shared/schema";
import { eq } from "drizzle-orm";
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
    .select({ id: siteConfig.id })
    .from(siteConfig)
    .where(eq(siteConfig.key, key));
  if (existing) {
    await db.update(siteConfig).set({ value: hash }).where(eq(siteConfig.key, key));
  } else {
    await db.insert(siteConfig).values({ id: createId(), key, value: hash });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedDatabase() {
  try {
    const data = seedData as any;

    const tableData = {
      categories:     (data.categories     || []) as any[],
      tags:           (data.tags           || []) as any[],
      products:       (data.products       || []) as any[],
      productImages:  (data.productImages  || []) as any[],
      productReviews: (data.productReviews || []) as any[],
      productTags:    (data.productTags    || []) as any[],
    };

    // ── 1. Check per-table hashes ─────────────────────────────────────────────
    const changed = {
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
      categories:     changed.categories,
      tags:           changed.tags,
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
      if (effective.productImages)  await db.delete(productImages);
      if (effective.productReviews) await db.delete(productReviews);
      if (effective.products)       await db.delete(products);
      if (effective.categories)     await db.delete(categories);
      if (effective.tags)           await db.delete(tags);

      // ── 3. Re-insert in dependency order ────────────────────────────────────

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

      // Tags
      if (effective.tags) {
        if (tableData.tags.length > 0) {
          await db.insert(tags).values(tableData.tags.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description ?? null,
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
            audience: p.audience ?? "kids",
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
            await db.insert(productImages).values(imgEntries.slice(i, i + BATCH));
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
        await db.insert(siteConfig).values({ id: sc.id || createId(), key: sc.key, value: sc.value });
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

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
