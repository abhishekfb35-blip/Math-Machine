import { createId } from "@paralleldrive/cuid2";
import { categories, products, carts, cartItems, orders, orderItems, siteConfig, productImages, productReviews, tags, productTags, auditLogs, customers, customerOtps, customerSessions, customerConsents, productVariants, currencyRates, pricingRules, categoryTagVariantConfigs, variantSizes, variantColors } from "@shared/schema";
import type {
  Category, InsertCategory,
  Product, InsertProduct,
  Cart, InsertCart,
  CartItem, InsertCartItem,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  SiteConfig,
  ProductImage, InsertProductImage,
  ProductReview, InsertProductReview,
  Tag, InsertTag,
  ProductTag, InsertProductTag,
  AuditLog, InsertAuditLog,
  Customer, InsertCustomer,
  CustomerConsent, InsertCustomerConsent,
  ColorOption, SizeOption,
  VariantColor, VariantSize, CategoryTagVariantConfig,
  ProductVariantOptions,
  ProductVariant, InsertProductVariant,
  CurrencyRate, InsertCurrencyRate,
  PricingRule, InsertPricingRule,
} from "@shared/types";
import { db } from "./db";
import { eq, and, or, ilike, sql, desc, asc, gt, inArray, count } from "drizzle-orm";

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
  deleteProduct(id: string): Promise<void>;

  getOrCreateCart(sessionId: string): Promise<Cart>;
  getCartItems(cartId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number, personalizationName?: string, selectedColor?: string | null, selectedSize?: string | null): Promise<CartItem | undefined>;
  removeCartItem(id: string): Promise<void>;
  clearCart(cartId: string): Promise<void>;

  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  updateOrderPayment(orderId: string, paymentId: string, paymentStatus: string): Promise<Order | undefined>;
  getAllOrders(filters?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<Order[]>;
  getOrderCount(filters?: { status?: string; search?: string }): Promise<number>;
  updateOrderStatus(orderId: string, status: string): Promise<Order | undefined>;
  updateOrderNotes(orderId: string, notes: string): Promise<Order | undefined>;

  getSiteConfig(key: string): Promise<SiteConfig | undefined>;
  getAllSiteConfigs(): Promise<SiteConfig[]>;
  upsertSiteConfig(key: string, value: string): Promise<SiteConfig>;

  getProductImages(productId: string): Promise<ProductImage[]>;
  createProductImage(img: InsertProductImage): Promise<ProductImage>;
  deleteProductImage(id: string): Promise<void>;
  reorderProductImages(productId: string, imageIds: string[]): Promise<void>;

  getProductReviews(productId: string): Promise<ProductReview[]>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  updateProductReview(id: string, data: Partial<InsertProductReview>): Promise<ProductReview>;
  deleteProductReview(id: string): Promise<void>;

  getTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<void>;

  getProductTags(productId: string): Promise<Tag[]>;
  setProductTags(productId: string, tagIds: string[]): Promise<void>;
  getProductTagIdsByCategory(categoryId: string): Promise<Record<string, string[]>>;

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
  getOrderByDiscountCode(code: string): Promise<Order | undefined>;

  getProductVariantOptions(productId: string): Promise<ProductVariantOptions>;
  upsertProductVariantOptions(productId: string, colors: ColorOption[], sizes: SizeOption[]): Promise<void>;
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  upsertProductVariants(productId: string, variants: { color: string; size: string; available: boolean }[]): Promise<void>;
  deleteProductVariantsByProduct(productId: string): Promise<void>;

  listCategoryTagVariantConfigs(categoryId: string): Promise<CategoryTagVariantConfig[]>;
  getVariantConfig(id: string): Promise<CategoryTagVariantConfig | null>;
  upsertVariantConfig(categoryId: string, tagId: string, sizes: Array<{
    name: string; description?: string; descriptionFontSize?: number; priceAdd: number; isDefault: boolean; blurOnFront: boolean; sortOrder: number;
    colors: Array<{ name: string; swatchUrl?: string; blurOnFront: boolean; sortOrder: number; }>;
  }>): Promise<string>;
  deleteVariantConfig(id: string): Promise<void>;

  getCurrencyRates(): Promise<CurrencyRate[]>;
  upsertCurrencyRate(currency: string, rateFromInr: number): Promise<CurrencyRate>;

  getPricingRules(): Promise<PricingRule[]>;
  getPricingRuleByCurrency(currency: string): Promise<PricingRule | undefined>;
  upsertPricingRule(data: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(currency: string, data: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
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

  private async withReviewStats(prods: Product[]): Promise<Product[]> {
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

  private async withTagNames(prods: Product[]): Promise<Product[]> {
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

  private async withEnriched(prods: Product[]): Promise<Product[]> {
    const withStats = await this.withReviewStats(prods);
    return this.withTagNames(withStats);
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
    return this.withTagNames(prods);
  }

  async searchAllProducts(query: string): Promise<Product[]> {
    const pattern = `%${query}%`;
    return await db.select().from(products)
      .where(
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.description, pattern),
        )
      )
      .orderBy(products.sortOrder, products.name);
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.slug, slug));
    if (!prod) return undefined;
    const [enriched] = await this.withTagNames([prod]);
    return enriched;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.id, id));
    if (!prod) return undefined;
    const [enriched] = await this.withTagNames([prod]);
    return enriched;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const prods = await db.select().from(products).where(inArray(products.id, ids));
    return this.withEnriched(prods);
  }

  async createProduct(prod: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values({ id: createId(), ...prod }).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    return updated;
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
        imageUrl: products.imageUrl,
        sku: products.sku,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));
    return rows;
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

  async updateOrderStatus(orderId: string, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status, updatedAt: new Date() })
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

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return await db.select().from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
  }

  async createProductImage(img: InsertProductImage): Promise<ProductImage> {
    const [created] = await db.insert(productImages).values({ id: createId(), ...img }).returning();
    return created;
  }

  async deleteProductImage(id: string): Promise<void> {
    await db.delete(productImages).where(eq(productImages.id, id));
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

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db.select().from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(productReviews.createdAt);
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

  async getTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(tags.name);
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

  async getProductTags(productId: string): Promise<Tag[]> {
    const rows = await db
      .select({ id: tags.id, name: tags.name, description: tags.description })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId));
    return rows;
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

  async getOrderByDiscountCode(code: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.discountCode, code));
    return order;
  }

  async getProductVariantOptions(productId: string): Promise<ProductVariantOptions> {
    const productResult = await db.execute(sql`
      SELECT p.category_id, pt.tag_id
      FROM products p
      LEFT JOIN product_tags pt ON pt.product_id = p.id
      WHERE p.id = ${productId}
      ORDER BY pt.id
      LIMIT 1
    `);
    const productRows = (Array.isArray(productResult) ? productResult : ((productResult as { rows?: unknown[] }).rows ?? [])) as { category_id: string; tag_id: string | null }[];
    if (productRows.length === 0) return { productId, sizes: [] };
    const { category_id: categoryId, tag_id: tagId } = productRows[0];

    if (!tagId) return { productId, sizes: [] };
    const [cfg] = await db.select().from(categoryTagVariantConfigs).where(
      and(eq(categoryTagVariantConfigs.categoryId, categoryId), eq(categoryTagVariantConfigs.tagId, tagId))
    );
    if (!cfg) return { productId, sizes: [] };
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
      return { id: cfg.id, categoryId: cfg.categoryId, tagId: cfg.tagId ?? null, sortOrder: cfg.sortOrder ?? 0, sizes };
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
    return { id: cfg.id, categoryId: cfg.categoryId, tagId: cfg.tagId ?? null, sortOrder: cfg.sortOrder ?? 0, sizes };
  }

  async upsertVariantConfig(categoryId: string, tagId: string, sizes: Array<{
    name: string; description?: string; descriptionFontSize?: number; priceAdd: number; isDefault: boolean; blurOnFront: boolean; sortOrder: number;
    colors: Array<{ name: string; swatchUrl?: string; blurOnFront: boolean; sortOrder: number; }>;
  }>): Promise<string> {
    const [existing] = await db.select().from(categoryTagVariantConfigs).where(
      and(eq(categoryTagVariantConfigs.categoryId, categoryId), eq(categoryTagVariantConfigs.tagId, tagId))
    );

    let configId: string;
    if (existing) {
      configId = existing.id;
      const existingSizeIds = (await db.select().from(variantSizes).where(eq(variantSizes.configId, configId))).map(s => s.id);
      for (const sizeId of existingSizeIds) {
        await db.delete(variantColors).where(eq(variantColors.sizeId, sizeId));
      }
      await db.delete(variantSizes).where(eq(variantSizes.configId, configId));
    } else {
      configId = createId();
      await db.insert(categoryTagVariantConfigs).values({ id: configId, categoryId, tagId, sortOrder: 0 });
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
    return configId;
  }

  async deleteVariantConfig(id: string): Promise<void> {
    const existingSizeIds = (await db.select().from(variantSizes).where(eq(variantSizes.configId, id))).map(s => s.id);
    for (const sizeId of existingSizeIds) {
      await db.delete(variantColors).where(eq(variantColors.sizeId, sizeId));
    }
    await db.delete(variantSizes).where(eq(variantSizes.configId, id));
    await db.delete(categoryTagVariantConfigs).where(eq(categoryTagVariantConfigs.id, id));
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
      ...(data.markupPercent !== undefined && { markupPercent: String(data.markupPercent) }),
    };
    const [updated] = await db.update(pricingRules).set(dbData).where(eq(pricingRules.currency, currency)).returning();
    return updated ? this.coercePricingRule(updated) : undefined;
  }
}

export const storage = new DatabaseStorage();
