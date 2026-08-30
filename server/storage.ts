import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import path from "path";
import { categories, products, carts, cartItems, orders, orderItems, siteConfig, siteContent, productImages, productReviews, tagTypes, tags, productTags, occasions, auditLogs, customers, customerOtps, customerSessions, customerConsents, productVariants, currencyRates, pricingRules, categoryTagVariantConfigs, variantSizes, variantColors, adminUsers, wishlists, rateLimitStats, audience, genders, themes, styles, productAudience, productGenders, productThemes, productStyles, colorSwatches, categorySizeDefinitions, paymentAttempts, requestLogs, ipGeoCache, bulkPriceRules } from "@shared/schema";
import { resolveGeo } from "./lib/geoLookup";

import type {
  Category, InsertCategory,
  Product, InsertProduct,
  Audience, InsertAudience,
  Gender, InsertGender,
  Theme, InsertTheme,
  Style, InsertStyle,
  Attributes,
  Cart, InsertCart,
  CartItem, InsertCartItem,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  SiteConfig,
  SiteContent,
  ProductImage, InsertProductImage,
  ProductReview, InsertProductReview,
  TagType, InsertTagType,
  Tag, InsertTag,
  ProductTag, InsertProductTag,
  Occasion, InsertOccasion,
  AuditLog, InsertAuditLog,
  Customer, InsertCustomer,
  CustomerConsent, InsertCustomerConsent,
  ColorOption, SizeOption,
  VariantColor, VariantSize, CategoryTagVariantConfig,
  ProductVariantOptions,
  ProductVariant, InsertProductVariant,
  CurrencyRate, InsertCurrencyRate,
  PricingRule, InsertPricingRule,
  AdminUser, InsertAdminUser,
  RateLimitStats,
  BulkPriceRule, InsertBulkPriceRule,
  ColorSwatch, InsertColorSwatch,
  CategorySizeDefinition, InsertCategorySizeDefinition,
  PaymentAttempt, InsertPaymentAttempt,
} from "@shared/types";
import { db } from "./db";
import { generateSku } from "./utils/sku";
import { eq, and, or, ilike, sql, desc, asc, gt, inArray, count, isNull } from "drizzle-orm";

// Intermediate type: a DB product row before image and attribute enrichment.
// The products table does not contain imageUrl or the normalized attribute arrays.
type RawProductRow = Omit<Product, "imageUrl" | "audience" | "genders" | "themes" | "styles" | "audienceNames" | "genderNames" | "themeNames" | "styleNames"> & {
  imageUrl?: string | null;
};
type EnrichedRawProductRow = Omit<Product, "audience" | "genders" | "themes" | "styles" | "audienceNames" | "genderNames" | "themeNames" | "styleNames"> & {
  imageUrl: string;
};

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getCategoryById(id: string): Promise<Category | undefined>;
  createCategory(cat: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  getProducts(): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getAllProductsByCategory(categoryId: string): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  searchAllProducts(query: string): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  getProductById(id: string): Promise<Product | undefined>;
  getProductsByIds(ids: string[]): Promise<Product[]>;
  createProduct(prod: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  bulkUpdateProductFields(updates: Array<{ id: string } & Partial<InsertProduct>>): Promise<number>;
  deleteProduct(id: string): Promise<void>;

  getOrCreateCart(sessionId: string): Promise<Cart>;
  getCartItems(cartId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number, personalizationName?: string, selectedColor?: string | null, selectedSize?: string | null): Promise<CartItem | undefined>;
  removeCartItem(id: string): Promise<void>;
  clearCart(cartId: string): Promise<void>;
  updateCartActivity(sessionId: string, customerId: string | null): Promise<void>;
  getAbandonedCarts(): Promise<Array<{ cartId: string; customerId: string | null; customerEmail: string; customerName: string | null; updatedAt: Date }>>;
  markCartAbandonedEmailSent(cartId: string): Promise<void>;
  markCheckoutStarted(cartId: string): Promise<void>;
  saveCheckoutEmail(cartId: string, email: string): Promise<void>;
  logPaymentAttempt(data: InsertPaymentAttempt): Promise<PaymentAttempt>;
  updatePaymentAttemptByRazorpayOrderId(razorpayOrderId: string, status: string, failureReason?: string, failureCode?: string): Promise<void>;
  linkPaymentAttemptToOrder(razorpayOrderId: string, orderId: string): Promise<void>;
  getCartFunnelStats(): Promise<import("@shared/types").FunnelStats>;
  getFunnelReport(from: Date, to: Date): Promise<import("@shared/types").FunnelReport>;

  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  updateOrderPayment(orderId: string, paymentId: string, paymentStatus: string): Promise<Order | undefined>;
  getAllOrders(filters?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<Order[]>;
  getOrderCount(filters?: { status?: string; search?: string }): Promise<number>;
  updateOrderStatus(orderId: string, status: string, shippingInfo?: { courierPartner?: string; serviceType?: string; trackingNumber?: string }): Promise<Order | undefined>;
  updateOrderNotes(orderId: string, notes: string): Promise<Order | undefined>;

  getSiteConfig(key: string): Promise<SiteConfig | undefined>;
  getAllSiteConfigs(): Promise<SiteConfig[]>;
  upsertSiteConfig(key: string, value: string): Promise<SiteConfig>;
  deleteSeedHash(table: string): Promise<void>;

  getSiteContent(key: string): Promise<SiteContent | undefined>;
  getAllSiteContents(): Promise<SiteContent[]>;
  upsertSiteContent(key: string, value: string): Promise<SiteContent>;

  getProductImages(productId: string): Promise<ProductImage[]>;
  getProductImagesByCategory(categoryId: string): Promise<Record<string, ProductImage[]>>;
  createProductImage(img: InsertProductImage): Promise<ProductImage>;
  deleteProductImage(id: string): Promise<void>;
  reorderProductImages(productId: string, imageIds: string[]): Promise<void>;
  bulkReplaceProductImages(productIds: string[], slots: { sortOrder: number; imageUrl: string }[]): Promise<void>;

  getProductReviews(productId: string): Promise<ProductReview[]>;
  getCustomerReviewForProduct(customerId: string, productId: string): Promise<ProductReview | undefined>;
  customerHasOrderedProduct(customerId: string, productId: string): Promise<boolean>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  updateProductReview(id: string, data: Partial<InsertProductReview>): Promise<ProductReview>;
  deleteProductReview(id: string): Promise<void>;

  getTagTypes(): Promise<TagType[]>;
  createTagType(data: InsertTagType): Promise<TagType>;
  updateTagType(id: string, data: Partial<InsertTagType>): Promise<TagType | undefined>;
  deleteTagType(id: string): Promise<void>;

  getTags(): Promise<Tag[]>;
  getTagsWithProductCount(): Promise<(Tag & { productCount: number })[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<void>;

  getOccasions(activeOnly?: boolean): Promise<Occasion[]>;
  getOccasionBySlug(slug: string): Promise<Occasion | undefined>;
  createOccasion(data: InsertOccasion): Promise<Occasion>;
  updateOccasion(id: string, data: Partial<InsertOccasion>): Promise<Occasion | undefined>;
  deleteOccasion(id: string): Promise<void>;

  getProductTags(productId: string): Promise<Tag[]>;
  getProductTagIds(productId: string): Promise<string[]>;
  setProductTags(productId: string, tagIds: string[]): Promise<void>;
  getProductTagIdsByCategory(categoryId: string): Promise<Record<string, string[]>>;
  getProductTagsForCatalog(categoryId: string): Promise<{ productTagMap: Record<string, string[]>; productTagNameMap: Record<string, string[]> }>;
  getAllProductsByCategoryNoTags(categoryId: string): Promise<Product[]>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { entityType?: string; entityId?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogCount(filters?: { entityType?: string; entityId?: string }): Promise<number>;
  getAuditLogTypeSummary(): Promise<{ entityType: string; count: number; lastChangeAt: Date | null }[]>;
  getAuditLogEntitySummary(entityType: string): Promise<{ entityId: string; entityName: string | null; count: number; lastChangeAt: Date | null; lastAction: string | null }[]>;

  getAllCustomers(filters?: { search?: string; limit?: number; offset?: number }): Promise<Customer[]>;
  getCustomersCount(filters?: { search?: string }): Promise<number>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerById(id: string): Promise<Customer | undefined>;
  getCustomerByGoogleId(googleId: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  createOtp(email: string, otp: string, expiresAt: Date): Promise<void>;
  verifyOtp(email: string, otp: string): Promise<boolean>;
  createCustomerSession(customerId: string, token: string, expiresAt: Date): Promise<void>;
  getCustomerBySessionToken(token: string): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;
  deleteCustomerSession(token: string): Promise<void>;
  getOrdersByCustomerId(customerId: string): Promise<Order[]>;

  createCustomerConsent(data: InsertCustomerConsent): Promise<CustomerConsent>;
  getCustomerConsentByEmail(email: string, consentType: string): Promise<CustomerConsent | undefined>;
  getCustomerConsentByPhone(phone: string, consentType: string): Promise<CustomerConsent | undefined>;
  getCustomerConsentByDiscountCode(code: string): Promise<CustomerConsent | undefined>;
  getCustomerConsents(filters?: { limit?: number; offset?: number }): Promise<CustomerConsent[]>;
  getCustomerConsentsCount(): Promise<number>;
  markConsentDiscountUsed(id: string): Promise<void>;
  resetConsentDiscountUsed(id: string): Promise<void>;
  getProductVariantOptions(productId: string): Promise<ProductVariantOptions>;
  upsertProductVariantOptions(productId: string, colors: ColorOption[], sizes: SizeOption[]): Promise<void>;
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  upsertProductVariants(productId: string, variants: { color: string; size: string; available: boolean }[]): Promise<void>;
  deleteProductVariantsByProduct(productId: string): Promise<void>;

  listCategoryTagVariantConfigs(categoryId: string): Promise<CategoryTagVariantConfig[]>;
  getVariantConfig(id: string): Promise<CategoryTagVariantConfig | null>;
  upsertVariantConfig(categoryId: string, tagId: string | null, audienceId: string | null, sizes: Array<{
    name: string; description?: string; descriptionFontSize?: number; priceAdd: number; isDefault: boolean; blurOnFront: boolean; sortOrder: number;
    colors: Array<{ name: string; swatchUrl?: string; blurOnFront: boolean; sortOrder: number; }>;
  }>): Promise<string>;
  deleteVariantConfig(id: string): Promise<void>;

  getBulkPriceRules(): Promise<BulkPriceRule[]>;
  upsertBulkPriceRule(data: InsertBulkPriceRule): Promise<BulkPriceRule>;
  deleteBulkPriceRule(id: string): Promise<void>;

  listColorSwatches(): Promise<ColorSwatch[]>;
  createColorSwatch(data: InsertColorSwatch): Promise<ColorSwatch>;
  updateColorSwatch(id: string, data: Partial<InsertColorSwatch>): Promise<ColorSwatch | undefined>;
  deleteColorSwatch(id: string): Promise<void>;

  listCategorySizeDefinitions(categoryId: string): Promise<CategorySizeDefinition[]>;
  createCategorySizeDefinition(data: InsertCategorySizeDefinition): Promise<CategorySizeDefinition>;
  updateCategorySizeDefinition(id: string, data: Partial<InsertCategorySizeDefinition>): Promise<CategorySizeDefinition | undefined>;
  deleteCategorySizeDefinition(id: string): Promise<void>;

  getCurrencyRates(): Promise<CurrencyRate[]>;
  upsertCurrencyRate(currency: string, rateFromInr: number): Promise<CurrencyRate>;

  getPricingRules(): Promise<PricingRule[]>;
  getPricingRuleByCurrency(currency: string): Promise<PricingRule | undefined>;
  upsertPricingRule(data: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(currency: string, data: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;

  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  getAdminUserById(id: string): Promise<AdminUser | undefined>;
  createAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, data: Partial<InsertAdminUser>): Promise<AdminUser | undefined>;

  getWishlistProductIds(customerId: string): Promise<string[]>;
  addToWishlist(customerId: string, productId: string): Promise<void>;
  removeFromWishlist(customerId: string, productId: string): Promise<void>;
  syncWishlist(customerId: string, productIds: string[]): Promise<void>;

  pruneGuestCarts(retentionDays: number): Promise<number>;

  upsertRateLimitStats(tier: string, endpointCategory: string, bucketHour: Date, addCount: number): Promise<void>;
  getRateLimitStats(sinceHours: number): Promise<RateLimitStats[]>;
  pruneRateLimitStats(retentionDays: number): Promise<void>;
  getActiveCustomerSessionCount(): Promise<number>;
  getRecentCustomerSignupCount(dayWindow: number): Promise<number>;
  cleanupOrphanedSwatches(): Promise<{ deleted: number; filenames: string[] }>;

  logRequest(data: { ip: string; path: string; method: string; statusCode?: number | null; userAgent?: string | null; sessionId?: string | null; customerId?: string | null; durationMs?: number | null }): Promise<void>;
  pruneRequestLogs(retentionDays: number): Promise<void>;
  getTrafficReport(from: Date, to: Date): Promise<import("@shared/types").TrafficReport>;

  getAttributes(): Promise<Attributes>;
  getAudiences(): Promise<Audience[]>;
  createAudience(data: InsertAudience): Promise<Audience>;
  updateAudience(id: string, data: Partial<InsertAudience>): Promise<Audience | undefined>;
  deleteAudience(id: string): Promise<void>;
  getGenders(): Promise<Gender[]>;
  createGender(data: InsertGender): Promise<Gender>;
  updateGender(id: string, data: Partial<InsertGender>): Promise<Gender | undefined>;
  deleteGender(id: string): Promise<void>;
  getThemes(): Promise<Theme[]>;
  createTheme(data: InsertTheme): Promise<Theme>;
  updateTheme(id: string, data: Partial<InsertTheme>): Promise<Theme | undefined>;
  deleteTheme(id: string): Promise<void>;
  getStyles(): Promise<Style[]>;
  createStyle(data: InsertStyle): Promise<Style>;
  updateStyle(id: string, data: Partial<InsertStyle>): Promise<Style | undefined>;
  deleteStyle(id: string): Promise<void>;
  setProductAudiences(productId: string, audienceIds: string[]): Promise<void>;
  setProductGenders(productId: string, genderIds: string[]): Promise<void>;
  setProductThemes(productId: string, themeIds: string[]): Promise<void>;
  setProductStyles(productId: string, styleIds: string[]): Promise<void>;
  getProductAttributeIds(productId: string): Promise<{ audienceIds: string[]; genderIds: string[]; themeIds: string[]; styleIds: string[] }>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug));
    return cat;
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(cat: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values({ id: createId(), ...cat }).returning();
    return created;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const categoryProducts = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, id));
    for (const prod of categoryProducts) {
      await this.deleteProduct(prod.id);
    }
    await db.delete(categories).where(eq(categories.id, id));
  }

  private async withReviewStats(prods: EnrichedRawProductRow[]): Promise<EnrichedRawProductRow[]> {
    if (prods.length === 0) return prods;
    const ids = prods.map(p => p.id);
    const stats = await db.select({
      productId: productReviews.productId,
      reviewCount: sql<number>`count(*)::int`,
      averageRating: sql<number>`round(avg(${productReviews.rating})::numeric, 1)`,
    }).from(productReviews)
      .where(inArray(productReviews.productId, ids))
      .groupBy(productReviews.productId);
    const statsMap = new Map(stats.map(s => [s.productId, s]));
    return prods.map(p => {
      const s = statsMap.get(p.id);
      return s ? { ...p, reviewCount: Number(s.reviewCount), averageRating: Number(s.averageRating) } : p;
    });
  }

  private async withTagNames(prods: EnrichedRawProductRow[]): Promise<EnrichedRawProductRow[]> {
    if (prods.length === 0) return prods;
    const ids = prods.map(p => p.id);
    const tagRows = await db.select({
      productId: productTags.productId,
      tagName: tags.name,
    }).from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(inArray(productTags.productId, ids));
    const tagMap = new Map<string, string[]>();
    for (const row of tagRows) {
      if (!tagMap.has(row.productId)) tagMap.set(row.productId, []);
      tagMap.get(row.productId)!.push(row.tagName);
    }
    return prods.map(p => ({ ...p, tagNames: tagMap.get(p.id) ?? [] }));
  }

  private async withAttributes(prods: EnrichedRawProductRow[]): Promise<Product[]> {
    if (prods.length === 0) return [];
    const ids = prods.map(p => p.id);

    const [agRows, genRows, themeRows, styleRows] = await Promise.all([
      db.select({ productId: productAudience.productId, attributeId: productAudience.audienceId, name: audience.name })
        .from(productAudience).innerJoin(audience, eq(productAudience.audienceId, audience.id))
        .where(inArray(productAudience.productId, ids)),
      db.select({ productId: productGenders.productId, attributeId: productGenders.genderId, name: genders.name })
        .from(productGenders).innerJoin(genders, eq(productGenders.genderId, genders.id))
        .where(inArray(productGenders.productId, ids)),
      db.select({ productId: productThemes.productId, attributeId: productThemes.themeId, name: themes.name })
        .from(productThemes).innerJoin(themes, eq(productThemes.themeId, themes.id))
        .where(inArray(productThemes.productId, ids)),
      db.select({ productId: productStyles.productId, attributeId: productStyles.styleId, name: styles.name })
        .from(productStyles).innerJoin(styles, eq(productStyles.styleId, styles.id))
        .where(inArray(productStyles.productId, ids)),
    ]);

    const agIdMap = new Map<string, string[]>();
    const genIdMap = new Map<string, string[]>();
    const themeIdMap = new Map<string, string[]>();
    const styleIdMap = new Map<string, string[]>();
    const agNameMap = new Map<string, string[]>();
    const genNameMap = new Map<string, string[]>();
    const themeNameMap = new Map<string, string[]>();
    const styleNameMap = new Map<string, string[]>();

    for (const r of agRows) {
      if (!agIdMap.has(r.productId)) agIdMap.set(r.productId, []);
      if (!agNameMap.has(r.productId)) agNameMap.set(r.productId, []);
      agIdMap.get(r.productId)!.push(r.attributeId);
      agNameMap.get(r.productId)!.push(r.name);
    }
    for (const r of genRows) {
      if (!genIdMap.has(r.productId)) genIdMap.set(r.productId, []);
      if (!genNameMap.has(r.productId)) genNameMap.set(r.productId, []);
      genIdMap.get(r.productId)!.push(r.attributeId);
      genNameMap.get(r.productId)!.push(r.name);
    }
    for (const r of themeRows) {
      if (!themeIdMap.has(r.productId)) themeIdMap.set(r.productId, []);
      if (!themeNameMap.has(r.productId)) themeNameMap.set(r.productId, []);
      themeIdMap.get(r.productId)!.push(r.attributeId);
      themeNameMap.get(r.productId)!.push(r.name);
    }
    for (const r of styleRows) {
      if (!styleIdMap.has(r.productId)) styleIdMap.set(r.productId, []);
      if (!styleNameMap.has(r.productId)) styleNameMap.set(r.productId, []);
      styleIdMap.get(r.productId)!.push(r.attributeId);
      styleNameMap.get(r.productId)!.push(r.name);
    }

    return prods.map(p => ({
      ...p,
      audience:      agIdMap.get(p.id) ?? [],
      genders:       genIdMap.get(p.id) ?? [],
      themes:        themeIdMap.get(p.id) ?? [],
      styles:        styleIdMap.get(p.id) ?? [],
      audienceNames: agNameMap.get(p.id) ?? [],
      genderNames:   genNameMap.get(p.id) ?? [],
      themeNames:    themeNameMap.get(p.id) ?? [],
      styleNames:    styleNameMap.get(p.id) ?? [],
    }));
  }

  private async withPrimaryImage(prods: RawProductRow[]): Promise<EnrichedRawProductRow[]> {
    if (prods.length === 0) return [];
    const ids = prods.map(p => p.id);
    const rows = await db.select({
      productId: productImages.productId,
      imageUrl: productImages.imageUrl,
    }).from(productImages)
      .where(and(inArray(productImages.productId, ids), eq(productImages.sortOrder, 0)));
    const imageMap = new Map<string, string>(rows.map(r => [r.productId, r.imageUrl]));
    return prods.map(p => {
      const primary = imageMap.get(p.id);
      return { ...p, imageUrl: primary ?? p.imageUrl ?? "" };
    });
  }

  private async withEnriched(prods: RawProductRow[]): Promise<Product[]> {
    const withImages = await this.withPrimaryImage(prods);
    const withStats  = await this.withReviewStats(withImages);
    const withTags   = await this.withTagNames(withStats);
    return this.withAttributes(withTags);
  }

  async getProducts(): Promise<Product[]> {
    const prods = await db.select().from(products).where(eq(products.active, true)).orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async getAllProducts(): Promise<Product[]> {
    const prods = await db.select().from(products).orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const prods = await db.select().from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)))
      .orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async getAllProductsByCategory(categoryId: string): Promise<Product[]> {
    const prods = await db.select().from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const pattern = `%${query}%`;
    const prods = await db.select().from(products)
      .where(and(
        eq(products.active, true),
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.description, pattern),
        )
      ))
      .orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async searchAllProducts(query: string): Promise<Product[]> {
    const pattern = `%${query}%`;
    const prods = await db.select().from(products)
      .where(
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.description, pattern),
        )
      )
      .orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.slug, slug));
    if (!prod) return undefined;
    const [enriched] = await this.withEnriched([prod]);
    return enriched;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.id, id));
    if (!prod) return undefined;
    const [enriched] = await this.withEnriched([prod]);
    return enriched;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const prods = await db.select().from(products).where(inArray(products.id, ids));
    return this.withEnriched(prods);
  }

  async createProduct(prod: InsertProduct): Promise<Product> {
    const { imageUrl, sku, ...productData } = prod;
    const id = createId();
    const [created] = await db.insert(products).values({
      id,
      ...productData,
      sku: sku ?? generateSku(),
    }).returning();
    if (imageUrl) {
      await db.insert(productImages).values({
        id: createId(),
        productId: id,
        imageUrl,
        sortOrder: 0,
        isPrimary: true,
      });
    }
    const [enriched] = await this.withEnriched([created]);
    return enriched;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const { imageUrl, sku, ...productData } = data;
    const dbData = sku === undefined || sku === null ? productData : { ...productData, sku };
    const [updated] = await db.update(products).set({ ...dbData, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    if (!updated) return undefined;
    if (imageUrl !== undefined && imageUrl) {
      const [existing] = await db.select({ id: productImages.id })
        .from(productImages)
        .where(and(eq(productImages.productId, id), eq(productImages.sortOrder, 0)));
      if (existing) {
        await db.update(productImages)
          .set({ imageUrl })
          .where(eq(productImages.id, existing.id));
      } else {
        await db.insert(productImages).values({
          id: createId(),
          productId: id,
          imageUrl,
          sortOrder: 0,
          isPrimary: true,
        });
      }
    }
    const [enriched] = await this.withEnriched([updated]);
    return enriched;
  }

  async bulkUpdateProductFields(updates: Array<{ id: string } & Partial<InsertProduct>>): Promise<number> {
    if (updates.length === 0) return 0;
    let count = 0;
    await db.transaction(async (tx) => {
      for (const { id, imageUrl, sku, ...fields } of updates) {
        if (Object.keys(fields).length === 0) continue;
        const dbFields = sku === undefined || sku === null ? fields : { ...fields, sku };
        await tx.update(products).set({ ...dbFields, updatedAt: new Date() }).where(eq(products.id, id));
        count++;
      }
    });
    return count;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(productTags).where(eq(productTags.productId, id));
    await db.delete(productImages).where(eq(productImages.productId, id));
    await db.delete(productReviews).where(eq(productReviews.productId, id));
    await db.delete(cartItems).where(eq(cartItems.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const [existing] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    if (existing) return existing;
    const [created] = await db.insert(carts).values({ id: createId(), sessionId }).returning();
    return created;
  }

  async getCartItems(cartId: string): Promise<CartItem[]> {
    return await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [created] = await db.insert(cartItems).values({ id: createId(), ...item }).returning();
    return created;
  }

  async updateCartItem(id: string, quantity: number, personalizationName?: string, selectedColor?: string | null, selectedSize?: string | null): Promise<CartItem | undefined> {
    const updates: Partial<CartItem> = { quantity };
    if (personalizationName !== undefined) {
      updates.personalizationName = personalizationName;
    }
    if (selectedColor !== undefined) {
      updates.selectedColor = selectedColor ?? null;
    }
    if (selectedSize !== undefined) {
      updates.selectedSize = selectedSize ?? null;
    }
    const [updated] = await db.update(cartItems).set(updates).where(eq(cartItems.id, id)).returning();
    return updated;
  }

  async removeCartItem(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(cartId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  }

  async updateCartActivity(sessionId: string, customerId: string | null): Promise<void> {
    if (customerId) {
      await db.update(carts)
        .set({ customerId, updatedAt: new Date(), abandonedEmailSentAt: null })
        .where(eq(carts.sessionId, sessionId));
    } else {
      await db.update(carts)
        .set({ customerId: null, updatedAt: new Date(), abandonedEmailSentAt: null })
        .where(eq(carts.sessionId, sessionId));
    }
  }

  async getAbandonedCarts(): Promise<Array<{ cartId: string; customerId: string | null; customerEmail: string; customerName: string | null; updatedAt: Date }>> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await db
      .select({
        cartId: carts.id,
        customerId: carts.customerId,
        checkoutEmail: carts.checkoutEmail,
        updatedAt: carts.updatedAt,
        customerEmail: customers.email,
        customerName: customers.name,
      })
      .from(carts)
      .leftJoin(customers, eq(customers.id, sql`${carts.customerId}`))
      .where(
        and(
          sql`${carts.updatedAt} IS NOT NULL`,
          sql`${carts.updatedAt} < ${oneHourAgo}`,
          sql`${carts.abandonedEmailSentAt} IS NULL`,
          sql`COALESCE(${carts.checkoutEmail}, ${customers.email}) IS NOT NULL`,
          sql`EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = ${carts.id})`,
          sql`NOT EXISTS (
            SELECT 1 FROM orders o
            WHERE (
              (${carts.customerId} IS NOT NULL AND o.customer_id = ${carts.customerId})
              OR (${carts.checkoutEmail} IS NOT NULL AND o.customer_email = ${carts.checkoutEmail})
            )
            AND o.created_at > ${carts.updatedAt}
          )`
        )
      );
    return rows
      .filter(r => r.updatedAt && (r.checkoutEmail || r.customerEmail))
      .map(r => ({
        cartId: r.cartId,
        customerId: r.customerId ?? null,
        customerEmail: (r.checkoutEmail || r.customerEmail) as string,
        customerName: r.customerName ?? null,
        updatedAt: r.updatedAt as Date,
      }));
  }

  async markCartAbandonedEmailSent(cartId: string): Promise<void> {
    await db.update(carts).set({ abandonedEmailSentAt: new Date() }).where(eq(carts.id, cartId));
  }

  async markCheckoutStarted(cartId: string): Promise<void> {
    const [existing] = await db.select({ checkoutStartedAt: carts.checkoutStartedAt }).from(carts).where(eq(carts.id, cartId));
    if (existing && !existing.checkoutStartedAt) {
      await db.update(carts).set({ checkoutStartedAt: new Date() }).where(eq(carts.id, cartId));
    }
  }

  async saveCheckoutEmail(cartId: string, email: string): Promise<void> {
    await db.update(carts).set({ checkoutEmail: email }).where(eq(carts.id, cartId));
  }

  async logPaymentAttempt(data: InsertPaymentAttempt): Promise<PaymentAttempt> {
    const [created] = await db.insert(paymentAttempts).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updatePaymentAttemptByRazorpayOrderId(razorpayOrderId: string, status: string, failureReason?: string, failureCode?: string): Promise<void> {
    await db.update(paymentAttempts).set({
      status,
      ...(failureReason !== undefined ? { failureReason } : {}),
      ...(failureCode !== undefined ? { failureCode } : {}),
    }).where(eq(paymentAttempts.razorpayOrderId, razorpayOrderId));
  }

  async linkPaymentAttemptToOrder(razorpayOrderId: string, orderId: string): Promise<void> {
    await db.update(paymentAttempts)
      .set({ orderId, status: "success" })
      .where(and(eq(paymentAttempts.razorpayOrderId, razorpayOrderId), eq(paymentAttempts.status, "initiated")));
  }

  async getCartFunnelStats(): Promise<import("@shared/types").FunnelStats> {
    const [checkoutStartedRow, emailCapturedRow, statusRows, failureRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(sql`${carts.checkoutStartedAt} IS NOT NULL`),
      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(sql`${carts.checkoutEmail} IS NOT NULL`),
      db.select({
        status: paymentAttempts.status,
        count: sql<number>`count(*)::int`,
      }).from(paymentAttempts).groupBy(paymentAttempts.status),
      db.select({
        reason: paymentAttempts.failureReason,
        code: paymentAttempts.failureCode,
        count: sql<number>`count(*)::int`,
      }).from(paymentAttempts)
        .where(eq(paymentAttempts.status, "failed"))
        .groupBy(paymentAttempts.failureReason, paymentAttempts.failureCode)
        .orderBy(desc(sql`count(*)`))
        .limit(10),
    ]);

    const paymentAttemptsByStatus: Record<string, number> = {};
    for (const row of statusRows) {
      paymentAttemptsByStatus[row.status] = Number(row.count);
    }

    return {
      checkoutStartedCount: Number(checkoutStartedRow[0]?.count ?? 0),
      emailCapturedCount: Number(emailCapturedRow[0]?.count ?? 0),
      paymentAttemptsByStatus,
      recentFailures: failureRows.map(r => ({ reason: r.reason, code: r.code, count: Number(r.count) })),
    };
  }

  async getFunnelReport(from: Date, to: Date): Promise<import("@shared/types").FunnelReport> {
    const [
      cartsCreatedRow,
      cartsWithItemsRow,
      checkoutStartedRow,
      paymentAttemptedRow,
      ordersCompletedRow,
      recoveryEmailsSentRow,
      failuresByReason,
      recentFailedAttempts,
      abandonedCartsRows,
      leadsTotalRow,
      registeredCustomersRow,
      checkoutEmailsCapturedRow,
      codesIssuedRow,
      codesRedeemedRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(and(sql`${carts.createdAt} >= ${from}`, sql`${carts.createdAt} <= ${to}`)),

      db.select({ count: sql<number>`count(distinct ${cartItems.cartId})::int` })
        .from(cartItems)
        .innerJoin(carts, eq(carts.id, cartItems.cartId))
        .where(and(sql`${carts.createdAt} >= ${from}`, sql`${carts.createdAt} <= ${to}`)),

      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(and(
          sql`${carts.checkoutStartedAt} IS NOT NULL`,
          sql`${carts.createdAt} >= ${from}`,
          sql`${carts.createdAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(paymentAttempts)
        .where(and(
          sql`${paymentAttempts.attemptAt} >= ${from}`,
          sql`${paymentAttempts.attemptAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(and(
          sql`${orders.createdAt} >= ${from}`,
          sql`${orders.createdAt} <= ${to}`,
          sql`${orders.status} != 'cancelled'`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(and(
          sql`${carts.abandonedEmailSentAt} IS NOT NULL`,
          sql`${carts.createdAt} >= ${from}`,
          sql`${carts.createdAt} <= ${to}`
        )),

      db.select({
        reason: paymentAttempts.failureReason,
        code: paymentAttempts.failureCode,
        count: sql<number>`count(*)::int`,
      }).from(paymentAttempts)
        .where(and(
          eq(paymentAttempts.status, "failed"),
          sql`${paymentAttempts.attemptAt} >= ${from}`,
          sql`${paymentAttempts.attemptAt} <= ${to}`
        ))
        .groupBy(paymentAttempts.failureReason, paymentAttempts.failureCode)
        .orderBy(desc(sql`count(*)`))
        .limit(10),

      db.select({
        id: paymentAttempts.id,
        cartId: paymentAttempts.cartId,
        attemptAt: paymentAttempts.attemptAt,
        failureReason: paymentAttempts.failureReason,
        failureCode: paymentAttempts.failureCode,
        amount: paymentAttempts.amount,
        razorpayOrderId: paymentAttempts.razorpayOrderId,
      }).from(paymentAttempts)
        .where(and(
          eq(paymentAttempts.status, "failed"),
          sql`${paymentAttempts.attemptAt} >= ${from}`,
          sql`${paymentAttempts.attemptAt} <= ${to}`
        ))
        .orderBy(desc(paymentAttempts.attemptAt))
        .limit(50),

      db.select({
        cartId: carts.id,
        createdAt: carts.createdAt,
        checkoutEmail: carts.checkoutEmail,
        checkoutStartedAt: carts.checkoutStartedAt,
        itemCount: sql<number>`count(${cartItems.id})::int`,
        estimatedValue: sql<number>`coalesce(sum(${products.price} * ${cartItems.quantity}), 0)::int`,
        recoveryEmailSent: sql<boolean>`${carts.abandonedEmailSentAt} IS NOT NULL`,
      }).from(carts)
        .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
        .leftJoin(products, eq(products.id, cartItems.productId))
        .where(and(
          sql`${carts.createdAt} >= ${from}`,
          sql`${carts.createdAt} <= ${to}`,
          sql`${carts.updatedAt} < NOW() - INTERVAL '1 hour'`,
          sql`NOT EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.cart_id = ${carts.id} AND pa.order_id IS NOT NULL)`
        ))
        .groupBy(carts.id, carts.createdAt, carts.checkoutEmail, carts.checkoutStartedAt, carts.abandonedEmailSentAt)
        .orderBy(desc(carts.createdAt))
        .limit(50),

      db.select({ count: sql<number>`count(*)::int` })
        .from(customerConsents)
        .where(and(
          sql`${customerConsents.consentedAt} >= ${from}`,
          sql`${customerConsents.consentedAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(and(
          sql`${customers.createdAt} >= ${from}`,
          sql`${customers.createdAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(carts)
        .where(and(
          sql`${carts.checkoutEmail} IS NOT NULL`,
          sql`${carts.createdAt} >= ${from}`,
          sql`${carts.createdAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(customerConsents)
        .where(and(
          sql`${customerConsents.discountCode} IS NOT NULL`,
          sql`${customerConsents.consentedAt} >= ${from}`,
          sql`${customerConsents.consentedAt} <= ${to}`
        )),

      db.select({ count: sql<number>`count(*)::int` })
        .from(customerConsents)
        .where(and(
          eq(customerConsents.discountUsed, true),
          sql`${customerConsents.consentedAt} >= ${from}`,
          sql`${customerConsents.consentedAt} <= ${to}`
        )),
    ]);

    const cartsWithItems = Number(cartsWithItemsRow[0]?.count ?? 0);
    const ordersCompleted = Number(ordersCompletedRow[0]?.count ?? 0);

    return {
      cartsCreated: Number(cartsCreatedRow[0]?.count ?? 0),
      cartsWithItems,
      checkoutStarted: Number(checkoutStartedRow[0]?.count ?? 0),
      paymentAttempted: Number(paymentAttemptedRow[0]?.count ?? 0),
      ordersCompleted,
      conversionRate: cartsWithItems > 0 ? Math.round((ordersCompleted / cartsWithItems) * 100) : 0,
      recoveryEmailsSent: Number(recoveryEmailsSentRow[0]?.count ?? 0),
      paymentFailuresByReason: failuresByReason.map(r => ({ reason: r.reason, code: r.code, count: Number(r.count) })),
      recentFailedAttempts: recentFailedAttempts.map(r => ({
        id: r.id,
        cartId: r.cartId,
        attemptAt: r.attemptAt ? r.attemptAt.toISOString() : null,
        failureReason: r.failureReason,
        failureCode: r.failureCode,
        amount: r.amount,
        razorpayOrderId: r.razorpayOrderId,
      })),
      abandonedCarts: abandonedCartsRows.map(c => {
        const emailSent = Boolean(c.recoveryEmailSent);
        const hasEmail = !!c.checkoutEmail;
        const checkoutStarted = !!c.checkoutStartedAt;

        const abandonmentStage = hasEmail
          ? "Entered email"
          : checkoutStarted
            ? "Started checkout"
            : "Added to cart only";

        const emailNotSentReason = emailSent
          ? null
          : hasEmail
            ? "Pending — will send on next job run"
            : checkoutStarted
              ? "No email captured (left before entering email)"
              : "No email captured (never reached checkout)";

        return {
          cartId: c.cartId,
          createdAt: c.createdAt ? c.createdAt.toISOString() : null,
          checkoutEmail: c.checkoutEmail,
          itemCount: Number(c.itemCount),
          estimatedValue: Number(c.estimatedValue),
          recoveryEmailSent: emailSent,
          abandonmentStage,
          emailNotSentReason,
        };
      }),
      leadsTotal: Number(leadsTotalRow[0]?.count ?? 0),
      registeredCustomers: Number(registeredCustomersRow[0]?.count ?? 0),
      checkoutEmailsCaptured: Number(checkoutEmailsCapturedRow[0]?.count ?? 0),
      discountCodesIssued: Number(codesIssuedRow[0]?.count ?? 0),
      discountCodesRedeemed: Number(codesRedeemedRow[0]?.count ?? 0),
    };
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values({ id: createId(), ...order }).returning();
    return created;
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [created] = await db.insert(orderItems).values({ id: createId(), ...item }).returning();
    return created;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const rows = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        productName: orderItems.productName,
        productPrice: orderItems.productPrice,
        quantity: orderItems.quantity,
        personalizationName: orderItems.personalizationName,
        selectedColor: orderItems.selectedColor,
        selectedSize: orderItems.selectedSize,
        isFree: orderItems.isFree,
        imageUrl: sql<string | null>`null`,
        sku: products.sku,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    const productIds = [...new Set(rows.filter(r => r.productId).map(r => r.productId as string))];
    if (productIds.length === 0) return rows;
    const primaryImages = await db.select({
      productId: productImages.productId,
      imageUrl: productImages.imageUrl,
    }).from(productImages)
      .where(and(inArray(productImages.productId, productIds), eq(productImages.sortOrder, 0)));
    const imageMap = new Map<string, string>(primaryImages.map(r => [r.productId, r.imageUrl]));
    return rows.map(row => ({
      ...row,
      imageUrl: row.productId ? (imageMap.get(row.productId) ?? null) : null,
    }));
  }

  async updateOrderPayment(orderId: string, paymentId: string, paymentStatus: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ paymentId, paymentStatus, status: paymentStatus === "paid" ? "confirmed" : "pending", updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async getAllOrders(filters?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<Order[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(orders.customerName, term),
          ilike(orders.customerEmail, term),
          ilike(orders.customerPhone, term),
          ilike(orders.id, term),
        )!
      );
    }
    const query = db.select().from(orders);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const result = await (where ? query.where(where) : query)
      .orderBy(desc(orders.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    return result;
  }

  async getOrderCount(filters?: { status?: string; search?: string }): Promise<number> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(orders.customerName, term),
          ilike(orders.customerEmail, term),
          ilike(orders.customerPhone, term),
          ilike(orders.id, term),
        )!
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = db.select({ count: sql<number>`count(*)` }).from(orders);
    const [result] = await (where ? query.where(where) : query);
    return Number(result.count);
  }

  async updateOrderStatus(orderId: string, status: string, shippingInfo?: { courierPartner?: string; serviceType?: string; trackingNumber?: string }): Promise<Order | undefined> {
    const setFields: Record<string, unknown> = { status, updatedAt: new Date() };
    if (shippingInfo?.courierPartner !== undefined) setFields.courierPartner = shippingInfo.courierPartner;
    if (shippingInfo?.serviceType !== undefined) setFields.serviceType = shippingInfo.serviceType;
    if (shippingInfo?.trackingNumber !== undefined) setFields.trackingNumber = shippingInfo.trackingNumber;
    const [updated] = await db.update(orders)
      .set(setFields)
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async updateOrderNotes(orderId: string, notes: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ notes, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async getSiteConfig(key: string): Promise<SiteConfig | undefined> {
    const [config] = await db.select().from(siteConfig).where(eq(siteConfig.key, key));
    return config;
  }

  async getAllSiteConfigs(): Promise<SiteConfig[]> {
    return await db.select().from(siteConfig);
  }

  async upsertSiteConfig(key: string, value: string): Promise<SiteConfig> {
    const [existing] = await db.select().from(siteConfig).where(eq(siteConfig.key, key));
    if (existing) {
      const [updated] = await db.update(siteConfig).set({ value }).where(eq(siteConfig.key, key)).returning();
      return updated;
    }
    const [created] = await db.insert(siteConfig).values({ key, value }).returning();
    return created;
  }

  async deleteSeedHash(table: string): Promise<void> {
    await db.delete(siteConfig).where(eq(siteConfig.key, `seed-hash-${table}`));
  }

  async getSiteContent(key: string): Promise<SiteContent | undefined> {
    const [row] = await db.select().from(siteContent).where(eq(siteContent.key, key));
    return row;
  }

  async getAllSiteContents(): Promise<SiteContent[]> {
    return await db.select().from(siteContent);
  }

  async upsertSiteContent(key: string, value: string): Promise<SiteContent> {
    const [existing] = await db.select().from(siteContent).where(eq(siteContent.key, key));
    if (existing) {
      const [updated] = await db.update(siteContent).set({ value }).where(eq(siteContent.key, key)).returning();
      return updated;
    }
    const [created] = await db.insert(siteContent).values({ key, value }).returning();
    return created;
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return await db.select().from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
  }

  async getProductImagesByCategory(categoryId: string): Promise<Record<string, ProductImage[]>> {
    const rows = await db.select({
      productId: productImages.productId,
      id: productImages.id,
      imageUrl: productImages.imageUrl,
      sortOrder: productImages.sortOrder,
      isPrimary: productImages.isPrimary,
    }).from(productImages)
      .innerJoin(products, eq(productImages.productId, products.id))
      .where(eq(products.categoryId, categoryId))
      .orderBy(productImages.sortOrder);
    const map: Record<string, ProductImage[]> = {};
    for (const row of rows) {
      if (!map[row.productId]) map[row.productId] = [];
      map[row.productId].push(row as ProductImage);
    }
    return map;
  }

  async createProductImage(img: InsertProductImage): Promise<ProductImage> {
    const [created] = await db.insert(productImages).values({ id: createId(), ...img }).returning();
    return created;
  }

  async deleteProductImage(id: string): Promise<void> {
    const [deleted] = await db.select({ productId: productImages.productId })
      .from(productImages).where(eq(productImages.id, id));
    await db.delete(productImages).where(eq(productImages.id, id));
    if (deleted?.productId) {
      const remaining = await db.select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, deleted.productId))
        .orderBy(productImages.sortOrder);
      await db.transaction(async (tx) => {
        for (let i = 0; i < remaining.length; i++) {
          await tx.update(productImages)
            .set({ sortOrder: i, isPrimary: i === 0 })
            .where(eq(productImages.id, remaining[i].id));
        }
      });
    }
  }

  async reorderProductImages(productId: string, imageIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await tx.update(productImages)
          .set({ sortOrder: i })
          .where(and(eq(productImages.id, imageIds[i]), eq(productImages.productId, productId)));
      }
    });
  }

  async bulkReplaceProductImages(productIds: string[], slots: { sortOrder: number; imageUrl: string }[]): Promise<void> {
    if (productIds.length === 0 || slots.length === 0) return;
    const sortOrders = slots.map(s => s.sortOrder);
    for (const productId of productIds) {
      await db.transaction(async (tx) => {
        const existing = await tx.select({ id: productImages.id }).from(productImages)
          .where(and(eq(productImages.productId, productId), inArray(productImages.sortOrder, sortOrders)));
        for (const img of existing) {
          await tx.delete(productImages).where(eq(productImages.id, img.id));
        }
        for (const slot of slots) {
          await tx.insert(productImages).values({ id: createId(), productId, imageUrl: slot.imageUrl, sortOrder: slot.sortOrder });
        }
      });
    }
  }

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db.select().from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(desc(productReviews.createdAt));
  }

  async getCustomerReviewForProduct(customerId: string, productId: string): Promise<ProductReview | undefined> {
    const [review] = await db.select().from(productReviews)
      .where(and(eq(productReviews.customerId, customerId), eq(productReviews.productId, productId)));
    return review;
  }

  async customerHasOrderedProduct(customerId: string, productId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          eq(orderItems.productId, productId),
          or(eq(orders.status, "confirmed"), eq(orders.status, "shipped"), eq(orders.status, "delivered"))
        )
      )
      .limit(1);
    return !!row;
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const [created] = await db.insert(productReviews).values({ id: createId(), ...review }).returning();
    return created;
  }

  async updateProductReview(id: string, data: Partial<InsertProductReview>): Promise<ProductReview> {
    const [updated] = await db.update(productReviews).set(data).where(eq(productReviews.id, id)).returning();
    return updated;
  }

  async deleteProductReview(id: string): Promise<void> {
    await db.delete(productReviews).where(eq(productReviews.id, id));
  }

  async getTagTypes(): Promise<TagType[]> {
    return await db.select().from(tagTypes).orderBy(tagTypes.sortOrder, tagTypes.name);
  }

  async createTagType(data: InsertTagType): Promise<TagType> {
    const [created] = await db.insert(tagTypes).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updateTagType(id: string, data: Partial<InsertTagType>): Promise<TagType | undefined> {
    const [updated] = await db.update(tagTypes).set(data).where(eq(tagTypes.id, id)).returning();
    return updated;
  }

  async deleteTagType(id: string): Promise<void> {
    await db.update(tags).set({ tagTypeId: null }).where(eq(tags.tagTypeId, id));
    await db.delete(tagTypes).where(eq(tagTypes.id, id));
  }

  async getTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(tags.tagTypeId, tags.sortOrder, tags.name);
  }

  async getTagsWithProductCount(): Promise<(Tag & { productCount: number })[]> {
    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        description: tags.description,
        tagTypeId: tags.tagTypeId,
        sortOrder: tags.sortOrder,
        productCount: count(productTags.id),
      })
      .from(tags)
      .leftJoin(productTags, eq(productTags.tagId, tags.id))
      .groupBy(tags.id, tags.name, tags.description, tags.tagTypeId, tags.sortOrder)
      .orderBy(tags.tagTypeId, tags.sortOrder, tags.name);
    return rows;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values({ id: createId(), ...tag }).returning();
    return created;
  }

  async updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined> {
    const [updated] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
    return updated;
  }

  async deleteTag(id: string): Promise<void> {
    await db.delete(productTags).where(eq(productTags.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));
  }

  private coerceOccasion(row: typeof occasions.$inferSelect): Occasion {
    const coerceWeights = (value: unknown): Record<string, number> | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const entries = Object.entries(value).filter(([, weight]) => typeof weight === "number" && Number.isFinite(weight));
      return Object.fromEntries(entries) as Record<string, number>;
    };
    return {
      ...row,
      boostTags: coerceWeights(row.boostTags),
      penaltyTags: coerceWeights(row.penaltyTags),
    };
  }

  async getOccasions(activeOnly = false): Promise<Occasion[]> {
    if (activeOnly) {
      const rows = await db.select().from(occasions).where(eq(occasions.active, true)).orderBy(occasions.sortOrder, occasions.name);
      return rows.map(row => this.coerceOccasion(row));
    }
    const rows = await db.select().from(occasions).orderBy(occasions.sortOrder, occasions.name);
    return rows.map(row => this.coerceOccasion(row));
  }

  async getOccasionBySlug(slug: string): Promise<Occasion | undefined> {
    const [occ] = await db.select().from(occasions).where(eq(occasions.slug, slug));
    return occ as Occasion | undefined;
  }

  async createOccasion(data: InsertOccasion): Promise<Occasion> {
    const [created] = await db.insert(occasions).values({ id: createId(), ...data }).returning();
    return created as Occasion;
  }

  async updateOccasion(id: string, data: Partial<InsertOccasion>): Promise<Occasion | undefined> {
    const [updated] = await db.update(occasions).set(data).where(eq(occasions.id, id)).returning();
    return updated as Occasion | undefined;
  }

  async deleteOccasion(id: string): Promise<void> {
    await db.delete(occasions).where(eq(occasions.id, id));
  }

  async getProductTags(productId: string): Promise<Tag[]> {
    const rows = await db
      .select({ id: tags.id, name: tags.name, description: tags.description, tagTypeId: tags.tagTypeId, sortOrder: tags.sortOrder })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId));
    return rows;
  }

  async getProductTagIds(productId: string): Promise<string[]> {
    const rows = await db.select({ tagId: productTags.tagId }).from(productTags).where(eq(productTags.productId, productId));
    return rows.map(r => r.tagId);
  }

  async setProductTags(productId: string, tagIds: string[]): Promise<void> {
    await db.delete(productTags).where(eq(productTags.productId, productId));
    if (tagIds.length > 0) {
      await db.insert(productTags).values(tagIds.map(tagId => ({ id: createId(), productId, tagId })));
    }
  }

  async getProductTagIdsByCategory(categoryId: string): Promise<Record<string, string[]>> {
    const rows = await db
      .select({ productId: productTags.productId, tagId: productTags.tagId })
      .from(productTags)
      .innerJoin(products, eq(productTags.productId, products.id))
      .where(eq(products.categoryId, categoryId));
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      if (!map[row.productId]) map[row.productId] = [];
      map[row.productId].push(row.tagId);
    }
    return map;
  }

  async getProductTagsForCatalog(categoryId: string): Promise<{ productTagMap: Record<string, string[]>; productTagNameMap: Record<string, string[]> }> {
    const rows = await db
      .select({ productId: productTags.productId, tagId: productTags.tagId, tagName: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .innerJoin(products, eq(productTags.productId, products.id))
      .where(eq(products.categoryId, categoryId));
    const productTagMap: Record<string, string[]> = {};
    const productTagNameMap: Record<string, string[]> = {};
    for (const row of rows) {
      if (!productTagMap[row.productId]) productTagMap[row.productId] = [];
      productTagMap[row.productId].push(row.tagId);
      if (!productTagNameMap[row.productId]) productTagNameMap[row.productId] = [];
      productTagNameMap[row.productId].push(row.tagName);
    }
    return { productTagMap, productTagNameMap };
  }

  async getAllProductsByCategoryNoTags(categoryId: string): Promise<Product[]> {
    const prods = await db.select().from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(products.sortOrder, products.name);
    return this.withEnriched(prods);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values({ id: createId(), ...log }).returning();
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, log.entityType), eq(auditLogs.entityId, log.entityId)));
    const count = Number(countResult[0]?.count || 0);
    if (count > 10) {
      const oldest = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, log.entityType), eq(auditLogs.entityId, log.entityId)))
        .orderBy(asc(auditLogs.createdAt))
        .limit(count - 10);
      for (const row of oldest) {
        await db.delete(auditLogs).where(eq(auditLogs.id, row.id));
      }
    }
    return created;
  }

  async getAuditLogs(filters?: { entityType?: string; entityId?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    const conditions = [];
    if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const query = db.select().from(auditLogs);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
    }
    return await query.orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
  }

  async getAuditLogCount(filters?: { entityType?: string; entityId?: string }): Promise<number> {
    const conditions = [];
    if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
    const query = db.select({ count: sql<number>`count(*)` }).from(auditLogs);
    if (conditions.length > 0) {
      const result = await query.where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    const result = await query;
    return Number(result[0]?.count || 0);
  }
  async getAuditLogTypeSummary(): Promise<{ entityType: string; count: number; lastChangeAt: Date | null }[]> {
    const result = await db
      .select({
        entityType: auditLogs.entityType,
        count: sql<number>`count(*)`,
        lastChangeAt: sql<Date>`max(${auditLogs.createdAt})`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.entityType)
      .orderBy(sql`max(${auditLogs.createdAt}) desc`);
    return result.map(r => ({ entityType: r.entityType, count: Number(r.count), lastChangeAt: r.lastChangeAt }));
  }

  async getAuditLogEntitySummary(entityType: string): Promise<{ entityId: string; entityName: string | null; count: number; lastChangeAt: Date | null; lastAction: string | null }[]> {
    const result = await db
      .select({
        entityId: auditLogs.entityId,
        entityName: sql<string | null>`(array_agg(${auditLogs.entityName} ORDER BY ${auditLogs.createdAt} DESC))[1]`,
        count: sql<number>`count(*)`,
        lastChangeAt: sql<Date>`max(${auditLogs.createdAt})`,
        lastAction: sql<string | null>`(array_agg(${auditLogs.action} ORDER BY ${auditLogs.createdAt} DESC))[1]`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.entityType, entityType))
      .groupBy(auditLogs.entityId)
      .orderBy(sql`max(${auditLogs.createdAt}) desc`);
    return result.map(r => ({
      entityId: r.entityId,
      entityName: r.entityName,
      count: Number(r.count),
      lastChangeAt: r.lastChangeAt,
      lastAction: r.lastAction,
    }));
  }

  async getAllCustomers(filters?: { search?: string; limit?: number; offset?: number }): Promise<Customer[]> {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    const search = filters?.search?.trim();
    const conditions = search
      ? or(
          ilike(customers.email, `%${search}%`),
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
        )
      : undefined;
    return db.select().from(customers)
      .where(conditions)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getCustomersCount(filters?: { search?: string }): Promise<number> {
    const search = filters?.search?.trim();
    const conditions = search
      ? or(
          ilike(customers.email, `%${search}%`),
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
        )
      : undefined;
    const [row] = await db.select({ count: count() }).from(customers).where(conditions);
    return row?.count ?? 0;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email.toLowerCase()));
    return customer;
  }

  async getCustomerById(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByGoogleId(googleId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.googleId, googleId));
    return customer;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values({ id: createId(), ...data, email: data.email.toLowerCase() }).returning();
    return customer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async createOtp(email: string, otp: string, expiresAt: Date): Promise<void> {
    await db.insert(customerOtps).values({ id: createId(), email: email.toLowerCase(), otp, expiresAt });
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const [record] = await db.select().from(customerOtps)
      .where(and(
        eq(customerOtps.email, email.toLowerCase()),
        eq(customerOtps.otp, otp),
        eq(customerOtps.used, false),
        gt(customerOtps.expiresAt, new Date())
      ))
      .orderBy(desc(customerOtps.createdAt))
      .limit(1);
    if (record) {
      await db.update(customerOtps).set({ used: true }).where(eq(customerOtps.id, record.id));
      return true;
    }
    return false;
  }

  async createCustomerSession(customerId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(customerSessions).values({ id: createId(), customerId, token, expiresAt });
  }

  async getCustomerBySessionToken(token: string): Promise<Customer | undefined> {
    const [session] = await db.select().from(customerSessions)
      .where(and(
        eq(customerSessions.token, token),
        gt(customerSessions.expiresAt, new Date())
      ));
    if (!session) return undefined;
    return this.getCustomerById(session.customerId);
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await db.delete(customerSessions).where(eq(customerSessions.token, token));
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }

  async createCustomerConsent(data: InsertCustomerConsent): Promise<CustomerConsent> {
    const [consent] = await db.insert(customerConsents).values({ id: createId(), ...data }).returning();
    return consent;
  }

  async getCustomerConsentByEmail(email: string, consentType: string): Promise<CustomerConsent | undefined> {
    const [consent] = await db.select().from(customerConsents)
      .where(and(
        eq(customerConsents.email, email),
        eq(customerConsents.consentType, consentType),
        eq(customerConsents.consentGiven, true),
        sql`${customerConsents.revokedAt} IS NULL`
      ));
    return consent;
  }

  async getCustomerConsentByPhone(phone: string, consentType: string): Promise<CustomerConsent | undefined> {
    const [consent] = await db.select().from(customerConsents)
      .where(and(
        eq(customerConsents.phone, phone),
        eq(customerConsents.consentType, consentType),
        eq(customerConsents.consentGiven, true),
        sql`${customerConsents.revokedAt} IS NULL`
      ));
    return consent;
  }

  async getCustomerConsentByDiscountCode(code: string): Promise<CustomerConsent | undefined> {
    const [consent] = await db.select().from(customerConsents)
      .where(and(
        eq(customerConsents.discountCode, code),
        eq(customerConsents.consentGiven, true),
        sql`${customerConsents.revokedAt} IS NULL`
      ));
    return consent;
  }

  async getCustomerConsents(filters?: { limit?: number; offset?: number }): Promise<CustomerConsent[]> {
    let query = db.select().from(customerConsents).orderBy(desc(customerConsents.consentedAt));
    if (filters?.limit) query = query.limit(filters.limit) as any;
    if (filters?.offset) query = query.offset(filters.offset) as any;
    return await query;
  }

  async getCustomerConsentsCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(customerConsents);
    return Number(result.count);
  }

  async markConsentDiscountUsed(id: string): Promise<void> {
    await db.update(customerConsents).set({ discountUsed: true }).where(eq(customerConsents.id, id));
  }

  async resetConsentDiscountUsed(id: string): Promise<void> {
    await db.update(customerConsents).set({ discountUsed: false }).where(eq(customerConsents.id, id));
  }

  async getProductVariantOptions(productId: string): Promise<ProductVariantOptions> {
    const productResult = await db.execute(sql`
      SELECT category_id FROM products WHERE id = ${productId} LIMIT 1
    `);
    const productRows = (Array.isArray(productResult) ? productResult : ((productResult as { rows?: unknown[] }).rows ?? [])) as { category_id: string }[];
    if (productRows.length === 0) return { productId, sizes: [] };
    const { category_id: categoryId } = productRows[0];

    // Get this product's audience IDs
    const paRows = await db.select({ audienceId: productAudience.audienceId })
      .from(productAudience)
      .where(eq(productAudience.productId, productId));
    const audienceIds = paRows.map(r => r.audienceId);

    let cfg;
    if (audienceIds.length > 0) {
      // Strict match — if the product has an audience, only an audience-specific config applies
      const [match] = await db.select().from(categoryTagVariantConfigs).where(
        and(eq(categoryTagVariantConfigs.categoryId, categoryId), inArray(categoryTagVariantConfigs.audienceId, audienceIds))
      ).limit(1);
      if (!match) return { productId, sizes: [] };
      cfg = match;
    } else {
      // No audience on this product → use the default config (both tagId and audienceId are null)
      const [defaultCfg] = await db.select().from(categoryTagVariantConfigs).where(
        and(eq(categoryTagVariantConfigs.categoryId, categoryId), isNull(categoryTagVariantConfigs.tagId), isNull(categoryTagVariantConfigs.audienceId))
      );
      if (!defaultCfg) return { productId, sizes: [] };
      cfg = defaultCfg;
    }
    const configId = cfg.id;

    const dbSizes = await db.select().from(variantSizes).where(eq(variantSizes.configId, configId)).orderBy(variantSizes.sortOrder);
    const sizesWithColors: VariantSize[] = await Promise.all(dbSizes.map(async (size) => {
      const dbColors = await db.select().from(variantColors).where(eq(variantColors.sizeId, size.id)).orderBy(variantColors.sortOrder);
      return {
        id: size.id,
        name: size.name,
        description: size.description ?? undefined,
        descriptionFontSize: size.descriptionFontSize ?? 12,
        priceAdd: size.priceAdd,
        mrpAdd: size.mrpAdd,
        isDefault: size.isDefault,
        blurOnFront: size.blurOnFront,
        sortOrder: size.sortOrder ?? 0,
        colors: dbColors.map(c => ({
          id: c.id,
          name: c.name,
          swatchUrl: c.swatchUrl ?? undefined,
          blurOnFront: c.blurOnFront,
          sortOrder: c.sortOrder ?? 0,
        })),
      };
    }));
    return { productId, sizes: sizesWithColors };
  }

  async upsertProductVariantOptions(productId: string, colors: ColorOption[], sizes: SizeOption[]): Promise<void> {
    await db.execute(sql`
      UPDATE products SET variant_colors = ${JSON.stringify(colors)}, variant_sizes = ${JSON.stringify(sizes)}
      WHERE id = ${productId}
    `);
  }

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }

  async upsertProductVariants(productId: string, variants: { color: string; size: string; available: boolean }[]): Promise<void> {
    await db.delete(productVariants).where(eq(productVariants.productId, productId));
    if (variants.length > 0) {
      await db.insert(productVariants).values(
        variants.map(v => ({ id: createId(), productId, color: v.color, size: v.size, available: v.available }))
      );
    }
  }

  async deleteProductVariantsByProduct(productId: string): Promise<void> {
    await db.delete(productVariants).where(eq(productVariants.productId, productId));
  }

  async listCategoryTagVariantConfigs(categoryId: string): Promise<CategoryTagVariantConfig[]> {
    const configs = await db.select().from(categoryTagVariantConfigs)
      .where(eq(categoryTagVariantConfigs.categoryId, categoryId))
      .orderBy(categoryTagVariantConfigs.sortOrder);
    return Promise.all(configs.map(async (cfg) => {
      const dbSizes = await db.select().from(variantSizes).where(eq(variantSizes.configId, cfg.id)).orderBy(variantSizes.sortOrder);
      const sizes: VariantSize[] = await Promise.all(dbSizes.map(async (size) => {
        const dbColors = await db.select().from(variantColors).where(eq(variantColors.sizeId, size.id)).orderBy(variantColors.sortOrder);
        return {
          id: size.id,
          name: size.name,
          description: size.description ?? undefined,
          descriptionFontSize: size.descriptionFontSize ?? 12,
          priceAdd: size.priceAdd,
          mrpAdd: size.mrpAdd,
          isDefault: size.isDefault,
          blurOnFront: size.blurOnFront,
          sortOrder: size.sortOrder ?? 0,
          colors: dbColors.map(c => ({
            id: c.id,
            name: c.name,
            swatchUrl: c.swatchUrl ?? undefined,
            blurOnFront: c.blurOnFront,
            sortOrder: c.sortOrder ?? 0,
          })),
        };
      }));
      return { id: cfg.id, categoryId: cfg.categoryId, tagId: cfg.tagId ?? null, audienceId: cfg.audienceId ?? null, sortOrder: cfg.sortOrder ?? 0, sizes };
    }));
  }

  async getVariantConfig(id: string): Promise<CategoryTagVariantConfig | null> {
    const [cfg] = await db.select().from(categoryTagVariantConfigs).where(eq(categoryTagVariantConfigs.id, id));
    if (!cfg) return null;
    const dbSizes = await db.select().from(variantSizes).where(eq(variantSizes.configId, id)).orderBy(variantSizes.sortOrder);
    const sizes: VariantSize[] = await Promise.all(dbSizes.map(async (size) => {
      const dbColors = await db.select().from(variantColors).where(eq(variantColors.sizeId, size.id)).orderBy(variantColors.sortOrder);
      return {
        id: size.id,
        name: size.name,
        description: size.description ?? undefined,
        descriptionFontSize: size.descriptionFontSize ?? 12,
        priceAdd: size.priceAdd,
        mrpAdd: size.mrpAdd,
        isDefault: size.isDefault,
        blurOnFront: size.blurOnFront,
        sortOrder: size.sortOrder ?? 0,
        colors: dbColors.map(c => ({
          id: c.id,
          name: c.name,
          swatchUrl: c.swatchUrl ?? undefined,
          blurOnFront: c.blurOnFront,
          sortOrder: c.sortOrder ?? 0,
        })),
      };
    }));
    return { id: cfg.id, categoryId: cfg.categoryId, tagId: cfg.tagId ?? null, audienceId: cfg.audienceId ?? null, sortOrder: cfg.sortOrder ?? 0, sizes };
  }

  private async cleanupSwatchFiles(urls: (string | null | undefined)[]): Promise<void> {
    try {
      const swatchPrefix = "/images/swatches/";
      const uniqueUrls = [...new Set(urls.filter((u): u is string => typeof u === "string" && u.startsWith(swatchPrefix)))];
      if (uniqueUrls.length === 0) return;
      const isProduction = process.env.NODE_ENV === "production";
      const swatchesDir = isProduction
        ? path.resolve(process.cwd(), "dist", "public", "images", "swatches")
        : path.resolve(process.cwd(), "client", "public", "images", "swatches");
      for (const url of uniqueUrls) {
        try {
          const rawFilename = url.slice(swatchPrefix.length);
          const safeFilename = path.basename(rawFilename);
          if (!safeFilename || safeFilename !== rawFilename) continue;
          const filePath = path.resolve(swatchesDir, safeFilename);
          if (!filePath.startsWith(swatchesDir + path.sep) && filePath !== swatchesDir) continue;
          const still = await db.select({ id: variantColors.id }).from(variantColors).where(eq(variantColors.swatchUrl, url)).limit(1);
          if (still.length === 0) {
            let deleted = false;
            try {
              await fs.promises.unlink(filePath);
              deleted = true;
            } catch (err: any) {
              if (err?.code !== "ENOENT") {
                console.warn(`[swatch-cleanup] Failed to delete ${safeFilename}: ${err?.message}`);
              }
            }
            if (deleted) {
              try {
                await this.createAuditLog({
                  entityType: "swatch-file",
                  entityId: safeFilename,
                  entityName: safeFilename,
                  action: "deleted",
                  changes: JSON.stringify({ filename: safeFilename, url }),
                  username: "system",
                });
              } catch (err: any) {
                console.warn(`[swatch-cleanup] Failed to log deletion of ${safeFilename}: ${err?.message}`);
              }
            }
          }
        } catch (err: any) {
          console.warn(`[swatch-cleanup] Skipping url ${url}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[swatch-cleanup] Cleanup aborted, ignoring: ${err?.message}`);
    }
  }

  async upsertVariantConfig(categoryId: string, tagId: string | null, audienceId: string | null, sizes: Array<{
    name: string; description?: string; descriptionFontSize?: number; priceAdd: number; mrpAdd: number; isDefault: boolean; blurOnFront: boolean; sortOrder: number;
    colors: Array<{ name: string; swatchUrl?: string; blurOnFront: boolean; sortOrder: number; }>;
  }>): Promise<string> {
    let whereClause;
    if (audienceId) {
      whereClause = and(eq(categoryTagVariantConfigs.categoryId, categoryId), eq(categoryTagVariantConfigs.audienceId, audienceId));
    } else if (tagId) {
      whereClause = and(eq(categoryTagVariantConfigs.categoryId, categoryId), eq(categoryTagVariantConfigs.tagId, tagId));
    } else {
      whereClause = and(eq(categoryTagVariantConfigs.categoryId, categoryId), isNull(categoryTagVariantConfigs.tagId), isNull(categoryTagVariantConfigs.audienceId));
    }
    const [existing] = await db.select().from(categoryTagVariantConfigs).where(whereClause);

    let configId: string;
    let oldSwatchUrls: (string | null)[] = [];
    if (existing) {
      configId = existing.id;
      const existingSizeIds = (await db.select().from(variantSizes).where(eq(variantSizes.configId, configId))).map(s => s.id);
      if (existingSizeIds.length > 0) {
        const oldColors = await db.select({ swatchUrl: variantColors.swatchUrl }).from(variantColors).where(inArray(variantColors.sizeId, existingSizeIds));
        oldSwatchUrls = oldColors.map(c => c.swatchUrl);
      }
      for (const sizeId of existingSizeIds) {
        await db.delete(variantColors).where(eq(variantColors.sizeId, sizeId));
      }
      await db.delete(variantSizes).where(eq(variantSizes.configId, configId));
    } else {
      configId = createId();
      await db.insert(categoryTagVariantConfigs).values({ id: configId, categoryId, tagId, audienceId, sortOrder: 0 });
    }

    for (const size of sizes) {
      const sizeId = createId();
      await db.insert(variantSizes).values({
        id: sizeId,
        configId,
        name: size.name,
        description: size.description ?? null,
        descriptionFontSize: size.descriptionFontSize ?? 12,
        priceAdd: size.priceAdd,
        mrpAdd: size.mrpAdd,
        isDefault: size.isDefault,
        blurOnFront: size.blurOnFront,
        sortOrder: size.sortOrder,
      });
      for (const color of size.colors) {
        await db.insert(variantColors).values({
          id: createId(),
          sizeId,
          name: color.name,
          swatchUrl: color.swatchUrl ?? null,
          blurOnFront: color.blurOnFront,
          sortOrder: color.sortOrder,
        });
      }
    }
    await this.cleanupSwatchFiles(oldSwatchUrls);
    return configId;
  }

  async listColorSwatches(): Promise<ColorSwatch[]> {
    return await db.select().from(colorSwatches).orderBy(colorSwatches.sortOrder);
  }

  async createColorSwatch(data: InsertColorSwatch): Promise<ColorSwatch> {
    const id = createId();
    const [row] = await db.insert(colorSwatches).values({ id, name: data.name, swatchUrl: data.swatchUrl ?? null, sortOrder: data.sortOrder ?? 0 }).returning();
    return row;
  }

  async updateColorSwatch(id: string, data: Partial<InsertColorSwatch>): Promise<ColorSwatch | undefined> {
    const [row] = await db.update(colorSwatches).set(data).where(eq(colorSwatches.id, id)).returning();
    return row;
  }

  async deleteColorSwatch(id: string): Promise<void> {
    await db.delete(colorSwatches).where(eq(colorSwatches.id, id));
  }

  async getBulkPriceRules(): Promise<BulkPriceRule[]> {
    return await db.select().from(bulkPriceRules).orderBy(asc(bulkPriceRules.sellingPrice));
  }

  async upsertBulkPriceRule(data: InsertBulkPriceRule): Promise<BulkPriceRule> {
    const existing = await db.select().from(bulkPriceRules).where(eq(bulkPriceRules.sellingPrice, data.sellingPrice));
    if (existing.length > 0) {
      const [row] = await db.update(bulkPriceRules).set({ bulkRate: data.bulkRate }).where(eq(bulkPriceRules.sellingPrice, data.sellingPrice)).returning();
      return row;
    }
    const [row] = await db.insert(bulkPriceRules).values({ id: createId(), sellingPrice: data.sellingPrice, bulkRate: data.bulkRate }).returning();
    return row;
  }

  async deleteBulkPriceRule(id: string): Promise<void> {
    await db.delete(bulkPriceRules).where(eq(bulkPriceRules.id, id));
  }

  async listCategorySizeDefinitions(categoryId: string): Promise<CategorySizeDefinition[]> {
    return await db.select().from(categorySizeDefinitions).where(eq(categorySizeDefinitions.categoryId, categoryId)).orderBy(categorySizeDefinitions.sortOrder);
  }

  async createCategorySizeDefinition(data: InsertCategorySizeDefinition): Promise<CategorySizeDefinition> {
    const id = createId();
    const [row] = await db.insert(categorySizeDefinitions).values({ id, categoryId: data.categoryId, name: data.name, description: data.description ?? null, sortOrder: data.sortOrder ?? 0 }).returning();
    return row;
  }

  async updateCategorySizeDefinition(id: string, data: Partial<InsertCategorySizeDefinition>): Promise<CategorySizeDefinition | undefined> {
    const [row] = await db.update(categorySizeDefinitions).set(data).where(eq(categorySizeDefinitions.id, id)).returning();
    return row;
  }

  async deleteCategorySizeDefinition(id: string): Promise<void> {
    await db.delete(categorySizeDefinitions).where(eq(categorySizeDefinitions.id, id));
  }

  async deleteVariantConfig(id: string): Promise<void> {
    const existingSizeIds = (await db.select().from(variantSizes).where(eq(variantSizes.configId, id))).map(s => s.id);
    let oldSwatchUrls: (string | null)[] = [];
    if (existingSizeIds.length > 0) {
      const oldColors = await db.select({ swatchUrl: variantColors.swatchUrl }).from(variantColors).where(inArray(variantColors.sizeId, existingSizeIds));
      oldSwatchUrls = oldColors.map(c => c.swatchUrl);
    }
    for (const sizeId of existingSizeIds) {
      await db.delete(variantColors).where(eq(variantColors.sizeId, sizeId));
    }
    await db.delete(variantSizes).where(eq(variantSizes.configId, id));
    await db.delete(categoryTagVariantConfigs).where(eq(categoryTagVariantConfigs.id, id));
    await this.cleanupSwatchFiles(oldSwatchUrls);
  }

  private coerceCurrencyRate(r: any): CurrencyRate {
    return { ...r, rateFromInr: Number(r.rateFromInr) };
  }

  private coercePricingRule(r: any): PricingRule {
    return { ...r, markupPercent: Number(r.markupPercent) };
  }

  async getCurrencyRates(): Promise<CurrencyRate[]> {
    const rows = await db.select().from(currencyRates).orderBy(currencyRates.currency);
    return rows.map(r => this.coerceCurrencyRate(r));
  }

  async upsertCurrencyRate(currency: string, rateFromInr: number): Promise<CurrencyRate> {
    const [existing] = await db.select().from(currencyRates).where(eq(currencyRates.currency, currency));
    if (existing) {
      const [updated] = await db.update(currencyRates)
        .set({ rateFromInr: String(rateFromInr), updatedAt: new Date() })
        .where(eq(currencyRates.currency, currency))
        .returning();
      return this.coerceCurrencyRate(updated);
    }
    const [created] = await db.insert(currencyRates).values({ id: createId(), currency, rateFromInr: String(rateFromInr) }).returning();
    return this.coerceCurrencyRate(created);
  }

  async getPricingRules(): Promise<PricingRule[]> {
    const rows = await db.select().from(pricingRules).orderBy(pricingRules.currency);
    return rows.map(r => this.coercePricingRule(r));
  }

  async getPricingRuleByCurrency(currency: string): Promise<PricingRule | undefined> {
    const [rule] = await db.select().from(pricingRules).where(eq(pricingRules.currency, currency));
    return rule ? this.coercePricingRule(rule) : undefined;
  }

  async upsertPricingRule(data: InsertPricingRule): Promise<PricingRule> {
    const dbData = { ...data, markupPercent: String(data.markupPercent ?? 0) };
    const [existing] = await db.select().from(pricingRules).where(eq(pricingRules.currency, data.currency));
    if (existing) {
      const [updated] = await db.update(pricingRules).set(dbData).where(eq(pricingRules.currency, data.currency)).returning();
      return this.coercePricingRule(updated);
    }
    const [created] = await db.insert(pricingRules).values({ id: createId(), ...dbData }).returning();
    return this.coercePricingRule(created);
  }

  async updatePricingRule(currency: string, data: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const dbData: Partial<typeof pricingRules.$inferInsert> = {
      ...data,
      markupPercent: data.markupPercent !== undefined ? String(data.markupPercent) : undefined,
    };
    const [updated] = await db.update(pricingRules).set(dbData).where(eq(pricingRules.currency, currency)).returning();
    return updated ? this.coercePricingRule(updated) : undefined;
  }

  private coerceAdminUser(row: typeof adminUsers.$inferSelect): AdminUser {
    return {
      ...row,
      permissions: (() => { try { return JSON.parse(row.permissions); } catch { return []; } })(),
    };
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    const rows = await db.select().from(adminUsers).orderBy(adminUsers.createdAt);
    return rows.map(r => this.coerceAdminUser(r));
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return row ? this.coerceAdminUser(row) : undefined;
  }

  async getAdminUserById(id: string): Promise<AdminUser | undefined> {
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return row ? this.coerceAdminUser(row) : undefined;
  }

  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const [row] = await db.insert(adminUsers).values({
      id: createId(),
      username: data.username,
      passwordHash: data.passwordHash,
      permissions: JSON.stringify(data.permissions ?? []),
      isActive: data.isActive ?? true,
    }).returning();
    return this.coerceAdminUser(row);
  }

  async updateAdminUser(id: string, data: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const updateData: Partial<typeof adminUsers.$inferInsert> = {
      ...(data.username !== undefined && { username: data.username }),
      ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
      ...(data.permissions !== undefined && { permissions: JSON.stringify(data.permissions) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
    const [row] = await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id)).returning();
    return row ? this.coerceAdminUser(row) : undefined;
  }

  async getWishlistProductIds(customerId: string): Promise<string[]> {
    const rows = await db.select({ productId: wishlists.productId })
      .from(wishlists)
      .where(eq(wishlists.customerId, customerId));
    return rows.map(r => r.productId);
  }

  async addToWishlist(customerId: string, productId: string): Promise<void> {
    await db.insert(wishlists)
      .values({ id: createId(), customerId, productId })
      .onConflictDoNothing();
  }

  async removeFromWishlist(customerId: string, productId: string): Promise<void> {
    await db.delete(wishlists).where(
      and(eq(wishlists.customerId, customerId), eq(wishlists.productId, productId))
    );
  }

  async syncWishlist(customerId: string, productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    const values = productIds.map(productId => ({ id: createId(), customerId, productId }));
    await db.insert(wishlists).values(values).onConflictDoNothing();
  }

  async pruneGuestCarts(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const guestCarts = await db
      .select({ id: carts.id })
      .from(carts)
      .where(
        and(
          sql`${carts.customerId} IS NULL`,
          sql`${carts.createdAt} < ${cutoff}`
        )
      );
    if (guestCarts.length === 0) return 0;
    const ids = guestCarts.map(c => c.id);
    await db.delete(cartItems).where(inArray(cartItems.cartId, ids));
    await db.delete(carts).where(inArray(carts.id, ids));
    return ids.length;
  }

  async upsertRateLimitStats(tier: string, endpointCategory: string, bucketHour: Date, addCount: number): Promise<void> {
    await db.execute(sql`
      INSERT INTO rate_limit_stats (id, tier, endpoint_category, bucket_hour, block_count)
      VALUES (${createId()}, ${tier}, ${endpointCategory}, ${bucketHour}, ${addCount})
      ON CONFLICT (tier, endpoint_category, bucket_hour)
      DO UPDATE SET block_count = rate_limit_stats.block_count + ${addCount}
    `);
  }

  async getRateLimitStats(sinceHours: number): Promise<RateLimitStats[]> {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const rows = await db.execute(sql`
      SELECT id, tier, endpoint_category, bucket_hour, block_count, created_at
      FROM rate_limit_stats
      WHERE bucket_hour >= ${since}
      ORDER BY bucket_hour DESC
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id,
      tier: r.tier,
      endpointCategory: r.endpoint_category,
      bucketHour: new Date(r.bucket_hour),
      blockCount: Number(r.block_count),
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  }

  async pruneRateLimitStats(retentionDays: number): Promise<void> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await db.execute(sql`DELETE FROM rate_limit_stats WHERE bucket_hour < ${cutoff}`);
  }

  async getActiveCustomerSessionCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customerSessions)
      .where(gt(customerSessions.expiresAt, new Date()));
    return Number(result?.count ?? 0);
  }

  async cleanupOrphanedSwatches(): Promise<{ deleted: number; filenames: string[] }> {
    const isProduction = process.env.NODE_ENV === "production";
    const swatchesDir = isProduction
      ? path.resolve(process.cwd(), "dist", "public", "images", "swatches")
      : path.resolve(process.cwd(), "client", "public", "images", "swatches");

    let files: string[];
    try {
      files = await fs.promises.readdir(swatchesDir);
    } catch (err: any) {
      if (err?.code === "ENOENT") return { deleted: 0, filenames: [] };
      throw err;
    }

    const deleted: string[] = [];
    for (const filename of files) {
      const filePath = path.resolve(swatchesDir, filename);
      if (!filePath.startsWith(swatchesDir + path.sep)) continue;
      const swatchUrl = `/images/swatches/${filename}`;
      const refs = await db
        .select({ id: variantColors.id })
        .from(variantColors)
        .where(eq(variantColors.swatchUrl, swatchUrl))
        .limit(1);
      if (refs.length === 0) {
        try {
          await fs.promises.unlink(filePath);
          deleted.push(filename);
        } catch (err: any) {
          if (err?.code !== "ENOENT") {
            console.warn(`[swatch-cleanup] Failed to delete ${filename}: ${err?.message}`);
          }
        }
      }
    }
    return { deleted: deleted.length, filenames: deleted };
  }

  async getRecentCustomerSignupCount(dayWindow: number): Promise<number> {
    const since = new Date(Date.now() - dayWindow * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(gt(customers.createdAt, since));
    return Number(result?.count ?? 0);
  }

  // ── Attribute CRUD ──────────────────────────────────────────────────────────

  async getAttributes(): Promise<Attributes> {
    const [ag, gen, th, st] = await Promise.all([
      db.select().from(audience).orderBy(audience.sortOrder, audience.name),
      db.select().from(genders).orderBy(genders.sortOrder, genders.name),
      db.select().from(themes).orderBy(themes.sortOrder, themes.name),
      db.select().from(styles).orderBy(styles.sortOrder, styles.name),
    ]);
    return { audience: ag, genders: gen, themes: th, styles: st };
  }

  async getAudiences(): Promise<Audience[]> {
    return db.select().from(audience).orderBy(audience.sortOrder, audience.name);
  }

  async createAudience(data: InsertAudience): Promise<Audience> {
    const [created] = await db.insert(audience).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updateAudience(id: string, data: Partial<InsertAudience>): Promise<Audience | undefined> {
    const [updated] = await db.update(audience).set(data).where(eq(audience.id, id)).returning();
    return updated;
  }

  async deleteAudience(id: string): Promise<void> {
    await db.delete(audience).where(eq(audience.id, id));
  }

  async getGenders(): Promise<Gender[]> {
    return db.select().from(genders).orderBy(genders.sortOrder, genders.name);
  }

  async createGender(data: InsertGender): Promise<Gender> {
    const [created] = await db.insert(genders).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updateGender(id: string, data: Partial<InsertGender>): Promise<Gender | undefined> {
    const [updated] = await db.update(genders).set(data).where(eq(genders.id, id)).returning();
    return updated;
  }

  async deleteGender(id: string): Promise<void> {
    await db.delete(genders).where(eq(genders.id, id));
  }

  async getThemes(): Promise<Theme[]> {
    return db.select().from(themes).orderBy(themes.sortOrder, themes.name);
  }

  async createTheme(data: InsertTheme): Promise<Theme> {
    const [created] = await db.insert(themes).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updateTheme(id: string, data: Partial<InsertTheme>): Promise<Theme | undefined> {
    const [updated] = await db.update(themes).set(data).where(eq(themes.id, id)).returning();
    return updated;
  }

  async deleteTheme(id: string): Promise<void> {
    await db.delete(themes).where(eq(themes.id, id));
  }

  async getStyles(): Promise<Style[]> {
    return db.select().from(styles).orderBy(styles.sortOrder, styles.name);
  }

  async createStyle(data: InsertStyle): Promise<Style> {
    const [created] = await db.insert(styles).values({ id: createId(), ...data }).returning();
    return created;
  }

  async updateStyle(id: string, data: Partial<InsertStyle>): Promise<Style | undefined> {
    const [updated] = await db.update(styles).set(data).where(eq(styles.id, id)).returning();
    return updated;
  }

  async deleteStyle(id: string): Promise<void> {
    await db.delete(styles).where(eq(styles.id, id));
  }

  async setProductAudiences(productId: string, audienceIds: string[]): Promise<void> {
    await db.delete(productAudience).where(eq(productAudience.productId, productId));
    if (audienceIds.length > 0) {
      await db.insert(productAudience).values(
        audienceIds.map(audienceId => ({ id: createId(), productId, audienceId }))
      ).onConflictDoNothing();
    }
  }

  async setProductGenders(productId: string, genderIds: string[]): Promise<void> {
    await db.delete(productGenders).where(eq(productGenders.productId, productId));
    if (genderIds.length > 0) {
      await db.insert(productGenders).values(
        genderIds.map(genderId => ({ id: createId(), productId, genderId }))
      ).onConflictDoNothing();
    }
  }

  async setProductThemes(productId: string, themeIds: string[]): Promise<void> {
    await db.delete(productThemes).where(eq(productThemes.productId, productId));
    if (themeIds.length > 0) {
      await db.insert(productThemes).values(
        themeIds.map(themeId => ({ id: createId(), productId, themeId }))
      ).onConflictDoNothing();
    }
  }

  async setProductStyles(productId: string, styleIds: string[]): Promise<void> {
    await db.delete(productStyles).where(eq(productStyles.productId, productId));
    if (styleIds.length > 0) {
      await db.insert(productStyles).values(
        styleIds.map(styleId => ({ id: createId(), productId, styleId }))
      ).onConflictDoNothing();
    }
  }

  async getProductAttributeIds(productId: string): Promise<{ audienceIds: string[]; genderIds: string[]; themeIds: string[]; styleIds: string[] }> {
    const [agRows, genRows, themeRows, styleRows] = await Promise.all([
      db.select({ audienceId: productAudience.audienceId }).from(productAudience).where(eq(productAudience.productId, productId)),
      db.select({ genderId: productGenders.genderId }).from(productGenders).where(eq(productGenders.productId, productId)),
      db.select({ themeId: productThemes.themeId }).from(productThemes).where(eq(productThemes.productId, productId)),
      db.select({ styleId: productStyles.styleId }).from(productStyles).where(eq(productStyles.productId, productId)),
    ]);
    return {
      audienceIds: agRows.map(r => r.audienceId),
      genderIds: genRows.map(r => r.genderId),
      themeIds: themeRows.map(r => r.themeId),
      styleIds: styleRows.map(r => r.styleId),
    };
  }

  // ── Request logging ──────────────────────────────────────────────────────────

  async logRequest(data: { ip: string; path: string; method: string; statusCode?: number | null; userAgent?: string | null; sessionId?: string | null; customerId?: string | null; durationMs?: number | null }): Promise<void> {
    try {
      await db.insert(requestLogs).values({
        id: createId(),
        ip: data.ip,
        path: data.path,
        method: data.method,
        statusCode: data.statusCode ?? null,
        userAgent: data.userAgent ?? null,
        sessionId: data.sessionId ?? null,
        customerId: data.customerId ?? null,
        durationMs: data.durationMs ?? null,
      });
    } catch {}
  }

  async pruneRequestLogs(retentionDays: number): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      await db.delete(requestLogs).where(sql`${requestLogs.createdAt} < ${cutoff}`);
    } catch {}
  }

  async getTrafficReport(from: Date, to: Date): Promise<import("@shared/types").TrafficReport> {
    const [
      [totalRow],
      [uniqueIpsRow],
      [uniqueSessionsRow],
      topPaths,
      ipAgg,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(requestLogs)
        .where(and(sql`${requestLogs.createdAt} >= ${from}`, sql`${requestLogs.createdAt} <= ${to}`)),
      db.select({ count: sql<number>`count(distinct ${requestLogs.ip})::int` })
        .from(requestLogs)
        .where(and(sql`${requestLogs.createdAt} >= ${from}`, sql`${requestLogs.createdAt} <= ${to}`)),
      db.select({ count: sql<number>`count(distinct ${requestLogs.sessionId})::int` })
        .from(requestLogs)
        .where(and(
          sql`${requestLogs.createdAt} >= ${from}`,
          sql`${requestLogs.createdAt} <= ${to}`,
          sql`${requestLogs.sessionId} IS NOT NULL`,
        )),
      db.select({
        path: requestLogs.path,
        count: sql<number>`count(*)::int`,
      }).from(requestLogs)
        .where(and(sql`${requestLogs.createdAt} >= ${from}`, sql`${requestLogs.createdAt} <= ${to}`))
        .groupBy(requestLogs.path)
        .orderBy(desc(sql`count(*)`))
        .limit(10),
      db.select({
        ip: requestLogs.ip,
        requestCount: sql<number>`count(*)::int`,
        firstSeen: sql<Date>`min(${requestLogs.createdAt})`,
        lastSeen: sql<Date>`max(${requestLogs.createdAt})`,
      }).from(requestLogs)
        .where(and(sql`${requestLogs.createdAt} >= ${from}`, sql`${requestLogs.createdAt} <= ${to}`))
        .groupBy(requestLogs.ip)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const ips = ipAgg.map(r => r.ip);

    // Anomaly thresholds are computed from the full IP population — no cap.
    // Path/UA enrichment is limited to the top 500 IPs by volume (practical for a table).
    const pathDataMap = new Map<string, string[]>();
    const uaMap = new Map<string, string>();

    if (ips.length > 0) {
      const batchIps = ips.slice(0, 500);
      const [pathData, uaData] = await Promise.all([
        db.select({
          ip: requestLogs.ip,
          path: requestLogs.path,
          count: sql<number>`count(*)::int`,
        }).from(requestLogs)
          .where(and(
            sql`${requestLogs.createdAt} >= ${from}`,
            sql`${requestLogs.createdAt} <= ${to}`,
            inArray(requestLogs.ip, batchIps),
          ))
          .groupBy(requestLogs.ip, requestLogs.path)
          .orderBy(requestLogs.ip, desc(sql`count(*)`)),
        db.select({
          ip: requestLogs.ip,
          userAgent: requestLogs.userAgent,
          count: sql<number>`count(*)::int`,
        }).from(requestLogs)
          .where(and(
            sql`${requestLogs.createdAt} >= ${from}`,
            sql`${requestLogs.createdAt} <= ${to}`,
            inArray(requestLogs.ip, batchIps),
            sql`${requestLogs.userAgent} IS NOT NULL`,
          ))
          .groupBy(requestLogs.ip, requestLogs.userAgent)
          .orderBy(requestLogs.ip, desc(sql`count(*)`)),
      ]);

      for (const row of pathData) {
        if (!pathDataMap.has(row.ip)) pathDataMap.set(row.ip, []);
        const paths = pathDataMap.get(row.ip)!;
        if (paths.length < 3) paths.push(row.path);
      }

      const uaSeen = new Set<string>();
      for (const row of uaData) {
        if (!uaSeen.has(row.ip)) {
          uaSeen.add(row.ip);
          if (row.userAgent) uaMap.set(row.ip, row.userAgent);
        }
      }
    }

    const geoMap = await resolveGeo(ips);

    const counts = ipAgg.map(r => Number(r.requestCount)).sort((a, b) => a - b);
    const median = counts.length > 0 ? counts[Math.floor(counts.length / 2)] : 1;
    const elevatedThreshold = Math.max(median * 2, 2);
    const highThreshold = Math.max(median * 3, 3);

    const [abandonedRow] = await db.select({ count: sql<number>`count(distinct ${carts.id})::int` })
      .from(carts)
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .where(and(
        sql`${carts.createdAt} >= ${from}`,
        sql`${carts.createdAt} <= ${to}`,
        sql`${carts.updatedAt} < NOW() - INTERVAL '1 hour'`,
        sql`NOT EXISTS (SELECT 1 FROM payment_attempts pa WHERE pa.cart_id = ${carts.id} AND pa.order_id IS NOT NULL)`,
      ));

    const ipRows = ipAgg.map(r => {
      const reqCount = Number(r.requestCount);
      const geo = geoMap.get(r.ip);
      const isAnomaly = reqCount >= highThreshold;
      const activityLevel: 'normal' | 'elevated' | 'high' =
        reqCount >= highThreshold ? 'high' : reqCount >= elevatedThreshold ? 'elevated' : 'normal';
      return {
        ip: r.ip,
        country: geo?.country ?? null,
        city: geo?.city ?? null,
        requestCount: reqCount,
        firstSeen: r.firstSeen instanceof Date ? r.firstSeen.toISOString() : String(r.firstSeen),
        lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen),
        topPaths: pathDataMap.get(r.ip) ?? [],
        userAgentSummary: uaMap.get(r.ip) ?? null,
        activityLevel,
        isAnomaly,
      };
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalRequests: Number(totalRow?.count ?? 0),
      uniqueIps: Number(uniqueIpsRow?.count ?? 0),
      uniqueSessions: Number(uniqueSessionsRow?.count ?? 0),
      topPaths: topPaths.map(r => ({ path: r.path, count: Number(r.count) })),
      ipRows,
      abandonedCartCount: Number(abandonedRow?.count ?? 0),
    };
  }
}

export const storage = new DatabaseStorage();
