import { db } from "./db";
import { categories, products, siteConfig, productImages, productReviews, tags, productTags, cartItems, carts } from "@shared/schema";
import { sql } from "drizzle-orm";
import seedData from "./seed-data.json";

interface SeedData {
  categories: any[];
  products: any[];
  productImages: any[];
  productReviews: any[];
  tags: any[];
  productTags: any[];
  siteConfig: any[];
}

export async function seedDatabase() {
  try {
    const [{ catCount }] = await db.select({ catCount: sql<number>`count(*)` }).from(categories);
    const [{ prodCount }] = await db.select({ prodCount: sql<number>`count(*)` }).from(products);
    const data = seedData as SeedData;

    const expectedProducts = data.products.length;
    const isFullySeeded = Number(catCount) > 0 && Number(prodCount) >= expectedProducts;

    if (isFullySeeded) {
      // Always sync site_config (including policy pages) on every run
      console.log(`Site config sync: seed data has ${data.siteConfig?.length || 0} entries`);
      if (data.siteConfig && data.siteConfig.length > 0) {
        let configSynced = 0;
        for (const sc of data.siteConfig) {
          try {
            const existing = await db.select().from(siteConfig).where(sql`${siteConfig.key} = ${sc.key}`);
            if (existing.length === 0) {
              console.log(`  Inserting missing config: ${sc.key}`);
              await db.insert(siteConfig).values({ key: sc.key, value: sc.value });
              configSynced++;
            } else if (existing[0].value !== sc.value) {
              await db.update(siteConfig).set({ value: sc.value }).where(sql`${siteConfig.key} = ${sc.key}`);
              configSynced++;
            }
          } catch (err: any) {
            console.error(`  Error syncing config key "${sc.key}":`, err.message);
          }
        }
        if (configSynced > 0) {
          console.log(`Synced ${configSynced} site config entries (including policy pages).`);
        } else {
          console.log(`Site config: all ${data.siteConfig.length} entries already up to date.`);
        }
      } else {
        console.log("Site config sync: no siteConfig data found in seed data!");
      }

      const [{ reviewCount }] = await db.select({ reviewCount: sql<number>`count(*)` }).from(productReviews);
      const expectedReviews = data.productReviews?.length || 0;

      const [{ orphanCount }] = await db.select({ orphanCount: sql<number>`count(*)` }).from(productReviews)
        .leftJoin(products, sql`${productReviews.productId} = ${products.id}`)
        .where(sql`${products.id} IS NULL`);
      const hasOrphans = Number(orphanCount) > 0;
      const needsSync = (expectedReviews > 0 && Number(reviewCount) < expectedReviews) || hasOrphans;

      if (needsSync) {
        if (hasOrphans) {
          console.log(`Found ${orphanCount} orphaned reviews (linked to non-existent products). Re-syncing all reviews...`);
        } else {
          console.log(`Syncing reviews: ${reviewCount} in DB, ${expectedReviews} in seed data. Adding missing reviews...`);
        }
        const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
        const slugToId: Record<string, string> = {};
        for (const p of allProducts) { slugToId[p.slug] = p.id; }
        
        await db.delete(productReviews);
        const skippedSlugs: string[] = [];
        const reviewValues = data.productReviews
          .filter((r: any) => {
            const slug = r.product_slug || r.productSlug;
            if (!slugToId[slug]) { skippedSlugs.push(slug); return false; }
            return true;
          })
          .map((r: any) => ({
            productId: slugToId[r.product_slug || r.productSlug],
            reviewerName: r.reviewer_name || r.reviewerName,
            rating: r.rating,
            title: r.title || null,
            body: r.body || null,
            amzReviewDate: r.review_date || r.amz_review_date || r.reviewDate || r.amzReviewDate || null,
            verifiedPurchase: r.verified_purchase ?? r.verifiedPurchase ?? true,
          }));
        if (skippedSlugs.length > 0) {
          const unique = Array.from(new Set(skippedSlugs));
          console.warn(`  WARNING: ${skippedSlugs.length} reviews skipped — product slugs not found: ${unique.join(', ')}`);
        }
        for (let i = 0; i < reviewValues.length; i += 100) {
          await db.insert(productReviews).values(reviewValues.slice(i, i + 100));
        }

        const [{ actualCount }] = await db.select({ actualCount: sql<number>`count(*)` }).from(productReviews);
        const [{ finalOrphanCount }] = await db.select({ finalOrphanCount: sql<number>`count(*)` }).from(productReviews)
          .leftJoin(products, sql`${productReviews.productId} = ${products.id}`)
          .where(sql`${products.id} IS NULL`);
        
        const inserted = Number(actualCount);
        const finalOrphans = Number(finalOrphanCount);
        if (inserted !== reviewValues.length) {
          console.error(`  VERIFICATION FAILED: Expected ${reviewValues.length} reviews, but found ${inserted} in DB.`);
        } else if (finalOrphans > 0) {
          console.error(`  VERIFICATION FAILED: ${finalOrphans} reviews are linked to non-existent products.`);
        } else {
          console.log(`  VERIFIED: ${inserted} reviews synced, all linked to valid products. 0 orphans.`);
        }
      } else {
        console.log("Database already seeded, skipping.");
      }

      const [{ imgCount }] = await db.select({ imgCount: sql<number>`count(*)` }).from(productImages);
      const expectedImages = data.productImages?.length || 0;
      if (expectedImages > 0 && Number(imgCount) < expectedImages) {
        console.log(`Syncing product images: ${imgCount} in DB, ${expectedImages} in seed data. Adding missing images...`);
        const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
        const slugToId: Record<string, string> = {};
        for (const p of allProducts) { slugToId[p.slug] = p.id; }

        await db.delete(productImages);

        const imgSkippedSlugs: string[] = [];
        const imgEntries = data.productImages
          .filter((img: any) => {
            const slug = img.productSlug || img.product_slug;
            if (!slugToId[slug]) { imgSkippedSlugs.push(slug); return false; }
            return true;
          })
          .map((img: any) => ({
            productId: slugToId[img.productSlug || img.product_slug],
            imageUrl: img.imageUrl || img.image_url,
            sortOrder: img.sortOrder ?? img.sort_order ?? 0,
            isPrimary: img.isPrimary ?? img.is_primary ?? false,
          }));
        if (imgSkippedSlugs.length > 0) {
          const unique = Array.from(new Set(imgSkippedSlugs));
          console.warn(`  WARNING: ${imgSkippedSlugs.length} images skipped — product slugs not found: ${unique.join(', ')}`);
        }
        for (let i = 0; i < imgEntries.length; i += 100) {
          await db.insert(productImages).values(imgEntries.slice(i, i + 100));
        }
        const [{ finalImgCount }] = await db.select({ finalImgCount: sql<number>`count(*)` }).from(productImages);
        console.log(`  VERIFIED: ${finalImgCount} product images synced.`);
      }

      return;
    }

    if (Number(catCount) > 0 || Number(prodCount) > 0) {
      console.log(`Outdated or partial seed detected (${prodCount} products, expected ${expectedProducts}). Clearing for fresh seed...`);
      await db.delete(cartItems);
      await db.delete(carts);
      await db.delete(productReviews);
      await db.delete(productImages);
      await db.delete(productTags);
      await db.delete(products);
      await db.delete(tags);
      await db.delete(siteConfig);
      await db.delete(categories);
    }

    console.log("Seeding database from seed-data.json...");

    const insertedCats = await db.insert(categories).values(
      data.categories.map((c: any) => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl || c.image_url,
        sortOrder: c.sortOrder ?? c.sort_order ?? 0,
      }))
    ).returning();
    console.log(`  Seeded ${insertedCats.length} categories`);

    const catSlugToId: Record<string, string> = {};
    for (const cat of insertedCats) {
      catSlugToId[cat.slug] = cat.id;
    }

    const BATCH_SIZE = 50;
    const skippedProducts = data.products.filter((p: any) => !catSlugToId[p.categorySlug || p.category_slug]);
    if (skippedProducts.length > 0) {
      console.warn(`  Warning: ${skippedProducts.length} products have unknown category slugs, skipping them.`);
    }

    const prodEntries = data.products.filter((p: any) => catSlugToId[p.categorySlug || p.category_slug]).map((p: any) => ({
      sku: p.sku || null,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      imageUrl: p.imageUrl || p.image_url,
      categoryId: catSlugToId[p.categorySlug || p.category_slug],
      amazonAsin: p.amazonAsin || p.amazon_asin,
      color: p.color,
      material: p.material,
      gsm: p.gsm,
      dimensions: p.dimensions,
      weightGrams: p.weightGrams || p.weight_grams,
      itemsInSet: p.itemsInSet || p.items_in_set,
      specialFeatures: p.specialFeatures || p.special_features,
      bulletPoints: p.bulletPoints || p.bullet_points,
      searchKeywords: p.searchKeywords || p.search_keywords,
      productType: p.productType || p.product_type || "towel",
      audience: p.audience || "kids",
      active: p.active !== false,
      sortOrder: p.sortOrder ?? p.sort_order ?? 0,
    }));

    const allInsertedProducts: any[] = [];
    for (let i = 0; i < prodEntries.length; i += BATCH_SIZE) {
      const batch = prodEntries.slice(i, i + BATCH_SIZE);
      const inserted = await db.insert(products).values(batch).returning();
      allInsertedProducts.push(...inserted);
    }
    console.log(`  Seeded ${allInsertedProducts.length} products`);

    const prodSlugToId: Record<string, string> = {};
    for (const prod of allInsertedProducts) {
      prodSlugToId[prod.slug] = prod.id;
    }

    if (data.productImages.length > 0) {
      const imgEntries = data.productImages
        .filter((img: any) => prodSlugToId[img.productSlug || img.product_slug])
        .map((img: any) => ({
          productId: prodSlugToId[img.productSlug || img.product_slug],
          imageUrl: img.imageUrl || img.image_url,
          sortOrder: img.sortOrder ?? img.sort_order ?? 0,
          isPrimary: img.isPrimary ?? img.is_primary ?? false,
        }));

      for (let i = 0; i < imgEntries.length; i += BATCH_SIZE) {
        const batch = imgEntries.slice(i, i + BATCH_SIZE);
        await db.insert(productImages).values(batch);
      }
      console.log(`  Seeded ${imgEntries.length} product images`);
    }

    if (data.productReviews.length > 0) {
      const skippedRevSlugs: string[] = [];
      const revEntries = data.productReviews
        .filter((r: any) => {
          const slug = r.productSlug || r.product_slug;
          if (!prodSlugToId[slug]) { skippedRevSlugs.push(slug); return false; }
          return true;
        })
        .map((r: any) => ({
          productId: prodSlugToId[r.productSlug || r.product_slug],
          reviewerName: r.reviewerName || r.reviewer_name,
          rating: r.rating,
          title: r.title,
          body: r.body,
          amzReviewDate: r.amzReviewDate || r.amz_review_date || r.reviewDate || r.review_date,
          verifiedPurchase: r.verifiedPurchase ?? r.verified_purchase ?? false,
        }));
      if (skippedRevSlugs.length > 0) {
        const unique = Array.from(new Set(skippedRevSlugs));
        console.warn(`  WARNING: ${skippedRevSlugs.length} reviews skipped — product slugs not found: ${unique.join(', ')}`);
      }

      for (let i = 0; i < revEntries.length; i += BATCH_SIZE) {
        const batch = revEntries.slice(i, i + BATCH_SIZE);
        await db.insert(productReviews).values(batch);
      }
      
      const [{ actualRevCount }] = await db.select({ actualRevCount: sql<number>`count(*)` }).from(productReviews);
      const [{ orphanRevCount }] = await db.select({ orphanRevCount: sql<number>`count(*)` }).from(productReviews)
        .leftJoin(products, sql`${productReviews.productId} = ${products.id}`)
        .where(sql`${products.id} IS NULL`);
      const revInserted = Number(actualRevCount);
      const revOrphans = Number(orphanRevCount);
      if (revInserted !== revEntries.length) {
        console.error(`  REVIEW VERIFICATION FAILED: Expected ${revEntries.length}, found ${revInserted} in DB.`);
      } else if (revOrphans > 0) {
        console.error(`  REVIEW VERIFICATION FAILED: ${revOrphans} reviews linked to non-existent products.`);
      } else {
        console.log(`  VERIFIED: ${revInserted} reviews seeded, all linked to valid products. 0 orphans.`);
      }
    }

    if (data.tags.length > 0) {
      const insertedTags = await db.insert(tags).values(
        data.tags.map((t: any) => ({
          name: t.name,
          description: t.description,
        }))
      ).returning();
      console.log(`  Seeded ${insertedTags.length} tags`);

      const tagNameToId: Record<string, string> = {};
      for (const tag of insertedTags) {
        tagNameToId[tag.name] = tag.id;
      }

      if (data.productTags.length > 0) {
        const ptEntries = data.productTags
          .filter((pt: any) => {
            const pSlug = pt.productSlug || pt.product_slug;
            const tName = pt.tagName || pt.tag_name;
            return prodSlugToId[pSlug] && tagNameToId[tName];
          })
          .map((pt: any) => ({
            productId: prodSlugToId[pt.productSlug || pt.product_slug],
            tagId: tagNameToId[pt.tagName || pt.tag_name],
          }));

        if (ptEntries.length > 0) {
          await db.insert(productTags).values(ptEntries);
          console.log(`  Seeded ${ptEntries.length} product tags`);
        }
      }
    }

    if (data.siteConfig.length > 0) {
      await db.insert(siteConfig).values(
        data.siteConfig.map((sc: any) => ({
          key: sc.key,
          value: sc.value,
        }))
      ).onConflictDoNothing();
      console.log(`  Seeded ${data.siteConfig.length} site config entries`);
    }

    const [{ finalCats }] = await db.select({ finalCats: sql<number>`count(*)` }).from(categories);
    const [{ finalProds }] = await db.select({ finalProds: sql<number>`count(*)` }).from(products);
    const [{ finalImgs }] = await db.select({ finalImgs: sql<number>`count(*)` }).from(productImages);
    const [{ finalRevs }] = await db.select({ finalRevs: sql<number>`count(*)` }).from(productReviews);
    const [{ finalTags }] = await db.select({ finalTags: sql<number>`count(*)` }).from(tags);
    console.log(`\n  === SEED VERIFICATION SUMMARY ===`);
    console.log(`  Categories: ${finalCats} (expected ${data.categories.length})`);
    console.log(`  Products:   ${finalProds} (expected ${data.products.length})`);
    console.log(`  Images:     ${finalImgs} (expected ${data.productImages.length})`);
    console.log(`  Reviews:    ${finalRevs} (expected ${data.productReviews.length})`);
    console.log(`  Tags:       ${finalTags} (expected ${data.tags.length})`);
    
    const mismatches = [];
    if (Number(finalCats) !== data.categories.length) mismatches.push('categories');
    if (Number(finalProds) < data.products.length) mismatches.push('products');
    if (Number(finalRevs) < data.productReviews.length) mismatches.push('reviews');
    if (mismatches.length > 0) {
      console.error(`  SEED WARNING: Mismatches in: ${mismatches.join(', ')}`);
    } else {
      console.log(`  ALL CHECKS PASSED — database seeding complete!`);
    }

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
