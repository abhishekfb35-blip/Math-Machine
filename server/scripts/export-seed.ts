import { db } from "../db";
import { categories, products, productImages, productReviews, tags, productTags, siteConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function exportSeed() {
  console.log("Exporting seed data from dev DB...");

  const cats = await db.select().from(categories).orderBy(categories.sortOrder);

  const prods = await db.select({
    id: products.id,
    name: products.name,
    slug: products.slug,
    description: products.description,
    price: products.price,
    mrp: products.mrp,
    imageUrl: products.imageUrl,
    categorySlug: categories.slug,
    amazonAsin: products.amazonAsin,
    color: products.color,
    material: products.material,
    gsm: products.gsm,
    dimensions: products.dimensions,
    weightGrams: products.weightGrams,
    itemsInSet: products.itemsInSet,
    specialFeatures: products.specialFeatures,
    bulletPoints: products.bulletPoints,
    searchKeywords: products.searchKeywords,
    productType: products.productType,
    audience: products.audience,
    active: products.active,
    sortOrder: products.sortOrder,
  }).from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(products.sortOrder);

  const imgs = await db.select({
    id: productImages.id,
    productSlug: products.slug,
    imageUrl: productImages.imageUrl,
    sortOrder: productImages.sortOrder,
    isPrimary: productImages.isPrimary,
  }).from(productImages)
    .leftJoin(products, eq(productImages.productId, products.id))
    .orderBy(productImages.sortOrder);

  const revs = await db.select({
    id: productReviews.id,
    productSlug: products.slug,
    reviewerName: productReviews.reviewerName,
    rating: productReviews.rating,
    title: productReviews.title,
    body: productReviews.body,
    amzReviewDate: productReviews.amzReviewDate,
    verifiedPurchase: productReviews.verifiedPurchase,
  }).from(productReviews)
    .leftJoin(products, eq(productReviews.productId, products.id))
    .orderBy(productReviews.createdAt);

  const tagList = await db.select().from(tags).orderBy(tags.name);

  const ptList = await db.select({
    id: productTags.id,
    productSlug: products.slug,
    tagName: tags.name,
  }).from(productTags)
    .leftJoin(products, eq(productTags.productId, products.id))
    .leftJoin(tags, eq(productTags.tagId, tags.id));

  const config = await db.select().from(siteConfig).orderBy(siteConfig.key);

  const seedData = {
    categories: cats.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      sortOrder: c.sortOrder,
    })),
    products: prods.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      imageUrl: p.imageUrl,
      categorySlug: p.categorySlug,
      amazonAsin: p.amazonAsin,
      color: p.color,
      material: p.material,
      gsm: p.gsm,
      dimensions: p.dimensions,
      weightGrams: p.weightGrams,
      itemsInSet: p.itemsInSet,
      specialFeatures: p.specialFeatures,
      bulletPoints: p.bulletPoints,
      searchKeywords: p.searchKeywords,
      productType: p.productType,
      audience: p.audience,
      active: p.active,
      sortOrder: p.sortOrder,
    })),
    productImages: imgs.map(img => ({
      id: img.id,
      productSlug: img.productSlug,
      imageUrl: img.imageUrl,
      sortOrder: img.sortOrder,
      isPrimary: img.isPrimary,
    })),
    productReviews: revs.map(r => ({
      id: r.id,
      productSlug: r.productSlug,
      reviewerName: r.reviewerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      amzReviewDate: r.amzReviewDate,
      verifiedPurchase: r.verifiedPurchase,
    })),
    tags: tagList.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    })),
    productTags: ptList.map(pt => ({
      id: pt.id,
      productSlug: pt.productSlug,
      tagName: pt.tagName,
    })),
    siteConfig: config.map(sc => ({
      id: sc.id,
      key: sc.key,
      value: sc.value,
    })),
  };

  const outputPath = path.join(process.cwd(), "server/seed-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2));

  console.log(`\nExported to ${outputPath}`);
  console.log(`  categories:     ${seedData.categories.length}`);
  console.log(`  products:       ${seedData.products.length}`);
  console.log(`  productImages:  ${seedData.productImages.length}`);
  console.log(`  productReviews: ${seedData.productReviews.length}`);
  console.log(`  tags:           ${seedData.tags.length}`);
  console.log(`  productTags:    ${seedData.productTags.length}`);
  console.log(`  siteConfig:     ${seedData.siteConfig.length}`);

  process.exit(0);
}

exportSeed().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
