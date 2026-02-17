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
      // Check if reviews need syncing
      const [{ reviewCount }] = await db.select({ reviewCount: sql<number>`count(*)` }).from(productReviews);
      const expectedReviews = data.productReviews?.length || 0;
      if (expectedReviews > 0 && Number(reviewCount) < expectedReviews) {
        console.log(`Syncing reviews: ${reviewCount} in DB, ${expectedReviews} in seed data. Adding missing reviews...`);
        const allProducts = await db.select({ id: products.id, slug: products.slug }).from(products);
        const slugToId: Record<string, number> = {};
        for (const p of allProducts) { slugToId[p.slug] = p.id; }
        
        await db.delete(productReviews);
        const reviewValues = data.productReviews
          .filter((r: any) => slugToId[r.product_slug || r.productSlug])
          .map((r: any) => ({
            productId: slugToId[r.product_slug || r.productSlug],
            reviewerName: r.reviewer_name || r.reviewerName,
            rating: r.rating,
            title: r.title || null,
            body: r.body || null,
            reviewDate: r.review_date || r.reviewDate || null,
            verifiedPurchase: r.verified_purchase ?? r.verifiedPurchase ?? true,
          }));
        for (let i = 0; i < reviewValues.length; i += 100) {
          await db.insert(productReviews).values(reviewValues.slice(i, i + 100));
        }
        console.log(`Reviews synced: ${reviewValues.length} reviews loaded.`);
      } else {
        console.log("Database already seeded, skipping.");
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

    const catSlugToId: Record<string, number> = {};
    for (const cat of insertedCats) {
      catSlugToId[cat.slug] = cat.id;
    }

    const BATCH_SIZE = 50;
    const skippedProducts = data.products.filter((p: any) => !catSlugToId[p.categorySlug || p.category_slug]);
    if (skippedProducts.length > 0) {
      console.warn(`  Warning: ${skippedProducts.length} products have unknown category slugs, skipping them.`);
    }

    const prodEntries = data.products.filter((p: any) => catSlugToId[p.categorySlug || p.category_slug]).map((p: any) => ({
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

    const prodSlugToId: Record<string, number> = {};
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
      const revEntries = data.productReviews
        .filter((r: any) => prodSlugToId[r.productSlug || r.product_slug])
        .map((r: any) => ({
          productId: prodSlugToId[r.productSlug || r.product_slug],
          reviewerName: r.reviewerName || r.reviewer_name,
          rating: r.rating,
          title: r.title,
          body: r.body,
          reviewDate: r.reviewDate || r.review_date,
          verifiedPurchase: r.verifiedPurchase ?? r.verified_purchase ?? false,
        }));

      for (let i = 0; i < revEntries.length; i += BATCH_SIZE) {
        const batch = revEntries.slice(i, i + BATCH_SIZE);
        await db.insert(productReviews).values(batch);
      }
      console.log(`  Seeded ${revEntries.length} product reviews`);
    }

    if (data.tags.length > 0) {
      const insertedTags = await db.insert(tags).values(
        data.tags.map((t: any) => ({
          name: t.name,
          description: t.description,
        }))
      ).returning();
      console.log(`  Seeded ${insertedTags.length} tags`);

      const tagNameToId: Record<string, number> = {};
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

    console.log("Database seeding complete!");

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
