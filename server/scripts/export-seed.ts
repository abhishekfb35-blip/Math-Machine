import { db } from "../db";
import {
  categories, products, productImages, productReviews, tags, tagTypes, productTags, siteConfig,
  categoryTagVariantConfigs, variantSizes, variantColors, currencyRates, pricingRules,
  audience, genders, themes, styles,
  productAudience, productGenders, productThemes, productStyles,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

async function exportSeed() {
  console.log("Exporting seed data from dev DB...");

  const cats = await db.select().from(categories).orderBy(categories.sortOrder);
  const ttList = await db.select().from(tagTypes).orderBy(tagTypes.sortOrder);

  // Fetch attribute lookup tables
  const agList  = await db.select().from(audience).orderBy(audience.sortOrder);
  const genList = await db.select().from(genders).orderBy(genders.sortOrder);
  const thList  = await db.select().from(themes).orderBy(themes.sortOrder);
  const stList  = await db.select().from(styles).orderBy(styles.sortOrder);

  // Fetch junction attribute assignments (used for both product enrichment and separate junction export)
  const pagList = await db.select({
    id: productAudience.id, productSlug: products.slug, audienceName: audience.name,
  }).from(productAudience)
    .innerJoin(products,   eq(productAudience.productId,  products.id))
    .innerJoin(audience,   eq(productAudience.audienceId, audience.id))
    .orderBy(products.slug, audience.name);

  const pgenList = await db.select({
    id: productGenders.id, productSlug: products.slug, genderName: genders.name,
  }).from(productGenders)
    .innerJoin(products, eq(productGenders.productId, products.id))
    .innerJoin(genders,  eq(productGenders.genderId,  genders.id))
    .orderBy(products.slug, genders.name);

  const pthList = await db.select({
    id: productThemes.id, productSlug: products.slug, themeName: themes.name,
  }).from(productThemes)
    .innerJoin(products, eq(productThemes.productId, products.id))
    .innerJoin(themes,   eq(productThemes.themeId,   themes.id))
    .orderBy(products.slug, themes.name);

  const pstList = await db.select({
    id: productStyles.id, productSlug: products.slug, styleName: styles.name,
  }).from(productStyles)
    .innerJoin(products, eq(productStyles.productId, products.id))
    .innerJoin(styles,   eq(productStyles.styleId,   styles.id))
    .orderBy(products.slug, styles.name);

  // Build productId → attribute-name[] maps for product row enrichment
  const agMap  = new Map<string, string[]>();
  const genMap = new Map<string, string[]>();
  const thMap  = new Map<string, string[]>();
  const stMap  = new Map<string, string[]>();
  for (const r of pagList)  agMap.set(r.productSlug,  [...(agMap.get(r.productSlug)   ?? []), r.audienceName]);
  for (const r of pgenList) genMap.set(r.productSlug, [...(genMap.get(r.productSlug)  ?? []), r.genderName]);
  for (const r of pthList)  thMap.set(r.productSlug,  [...(thMap.get(r.productSlug)   ?? []), r.themeName]);
  for (const r of pstList)  stMap.set(r.productSlug,  [...(stMap.get(r.productSlug)   ?? []), r.styleName]);

  const prods = await db.select({
    id: products.id,
    sku: products.sku,
    name: products.name,
    slug: products.slug,
    description: products.description,
    price: products.price,
    mrp: products.mrp,
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

  const ctvcList = await db.select({
    id: categoryTagVariantConfigs.id,
    categorySlug: categories.slug,
    tagId: categoryTagVariantConfigs.tagId,
    sortOrder: categoryTagVariantConfigs.sortOrder,
  }).from(categoryTagVariantConfigs)
    .leftJoin(categories, eq(categoryTagVariantConfigs.categoryId, categories.id))
    .orderBy(categoryTagVariantConfigs.id);

  const vsList = await db.select().from(variantSizes).orderBy(variantSizes.sortOrder);

  const vcList = await db.select().from(variantColors).orderBy(variantColors.sortOrder);

  const crList = await db.select().from(currencyRates).orderBy(currencyRates.currency);

  const prList = await db.select().from(pricingRules).orderBy(pricingRules.currency);

  // ── Bundle swatch images ────────────────────────────────────────────────────
  // Only referenced swatches are copied (files not referenced by any variantColor.swatchUrl
  // are intentionally excluded). To remove orphaned files from client/public/images/swatches/,
  // run: node server/scripts/cleanup-swatches.ts
  const swatchesSrcDir = path.join(process.cwd(), "client/public/images/swatches");
  const swatchesDestDir = path.join(process.cwd(), "server/seed-assets/swatches");

  if (!fs.existsSync(swatchesDestDir)) {
    fs.mkdirSync(swatchesDestDir, { recursive: true });
    console.log(`Created directory: server/seed-assets/swatches/`);
  }

  let swatchesCopied = 0;
  let swatchesSkipped = 0;

  const swatchUrls = [...new Set(
    vcList
      .map(vc => vc.swatchUrl)
      .filter((url): url is string => !!url)
  )];

  for (const swatchUrl of swatchUrls) {
    const filename = path.basename(swatchUrl);
    const srcPath = path.join(swatchesSrcDir, filename);
    const destPath = path.join(swatchesDestDir, filename);

    if (!fs.existsSync(srcPath)) {
      console.warn(`  [swatches] Source file not found, skipping: ${filename}`);
      continue;
    }

    // Skip if destination already exists and has identical content (hash check)
    if (fs.existsSync(destPath)) {
      const srcHash = crypto.createHash("md5").update(fs.readFileSync(srcPath)).digest("hex");
      const destHash = crypto.createHash("md5").update(fs.readFileSync(destPath)).digest("hex");
      if (srcHash === destHash) {
        swatchesSkipped++;
        continue;
      }
    }

    fs.copyFileSync(srcPath, destPath);
    swatchesCopied++;
  }

  console.log(`  swatches: copied ${swatchesCopied}, skipped (identical) ${swatchesSkipped}`);

  const seedData = {
    tagTypes: ttList.map(tt => ({
      id: tt.id,
      name: tt.name,
      slug: tt.slug,
      description: tt.description,
      sortOrder: tt.sortOrder ?? 0,
    })),
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
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
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
      audience: (agMap.get(p.slug)  ?? []).join(","),
      gender:   (genMap.get(p.slug) ?? []).join(","),
      themes:   (thMap.get(p.slug)  ?? []).join(","),
      styles:   (stMap.get(p.slug)  ?? []).join(","),
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
      tagTypeId: t.tagTypeId ?? null,
      sortOrder: t.sortOrder ?? 0,
    })),
    productTags: ptList.map(pt => ({
      id: pt.id,
      productSlug: pt.productSlug,
      tagName: pt.tagName,
    })),
    siteConfig: config.map(sc => ({
      key: sc.key,
      value: sc.value,
    })),
    categoryTagVariantConfigs: ctvcList.map(c => ({
      id: c.id,
      categorySlug: c.categorySlug,
      tagId: c.tagId,
      sortOrder: c.sortOrder,
    })),
    variantSizes: vsList.map(vs => ({
      id: vs.id,
      configId: vs.configId,
      name: vs.name,
      description: vs.description,
      descriptionFontSize: vs.descriptionFontSize,
      priceAdd: vs.priceAdd,
      isDefault: vs.isDefault,
      blurOnFront: vs.blurOnFront,
      sortOrder: vs.sortOrder,
    })),
    variantColors: vcList.map(vc => ({
      id: vc.id,
      sizeId: vc.sizeId,
      name: vc.name,
      swatchUrl: vc.swatchUrl,
      blurOnFront: vc.blurOnFront,
      sortOrder: vc.sortOrder,
    })),
    currencyRates: crList.map(cr => ({
      id: cr.id,
      currency: cr.currency,
      rateFromInr: cr.rateFromInr,
    })),
    pricingRules: prList.map(pr => ({
      id: pr.id,
      currency: pr.currency,
      symbol: pr.symbol,
      displayName: pr.displayName,
      markupPercent: pr.markupPercent,
      roundingRule: pr.roundingRule,
      enabled: pr.enabled,
    })),
    audience: agList.map(r => ({ id: r.id, name: r.name, sortOrder: r.sortOrder ?? 0 })),
    genders:   genList.map(r => ({ id: r.id, name: r.name, sortOrder: r.sortOrder ?? 0 })),
    themes:    thList.map(r  => ({ id: r.id, name: r.name, sortOrder: r.sortOrder ?? 0 })),
    styles:    stList.map(r  => ({ id: r.id, name: r.name, sortOrder: r.sortOrder ?? 0 })),
    productAudience: pagList.map(r  => ({ id: r.id, productSlug: r.productSlug, audienceName: r.audienceName })),
    productGenders:   pgenList.map(r => ({ id: r.id, productSlug: r.productSlug, genderName:   r.genderName   })),
    productThemes:    pthList.map(r  => ({ id: r.id, productSlug: r.productSlug, themeName:    r.themeName    })),
    productStyles:    pstList.map(r  => ({ id: r.id, productSlug: r.productSlug, styleName:    r.styleName    })),
  };

  const outputPath = path.join(process.cwd(), "server/seed-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2));

  console.log(`\nExported to ${outputPath}`);
  console.log(`  tagTypes:                  ${seedData.tagTypes.length}`);
  console.log(`  categories:                ${seedData.categories.length}`);
  console.log(`  products:                  ${seedData.products.length}`);
  console.log(`  productImages:             ${seedData.productImages.length}`);
  console.log(`  productReviews:            ${seedData.productReviews.length}`);
  console.log(`  tags:                      ${seedData.tags.length}`);
  console.log(`  productTags:               ${seedData.productTags.length}`);
  console.log(`  siteConfig:                ${seedData.siteConfig.length}`);
  console.log(`  categoryTagVariantConfigs: ${seedData.categoryTagVariantConfigs.length}`);
  console.log(`  variantSizes:              ${seedData.variantSizes.length}`);
  console.log(`  variantColors:             ${seedData.variantColors.length}`);
  console.log(`  currencyRates:             ${seedData.currencyRates.length}`);
  console.log(`  pricingRules:              ${seedData.pricingRules.length}`);
  console.log(`  audience:                  ${seedData.audience.length}`);
  console.log(`  genders:                   ${seedData.genders.length}`);
  console.log(`  themes:                    ${seedData.themes.length}`);
  console.log(`  styles:                    ${seedData.styles.length}`);
  console.log(`  productAudience:           ${seedData.productAudience.length}`);
  console.log(`  productGenders:            ${seedData.productGenders.length}`);
  console.log(`  productThemes:             ${seedData.productThemes.length}`);
  console.log(`  productStyles:             ${seedData.productStyles.length}`);

  process.exit(0);
}

exportSeed().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
