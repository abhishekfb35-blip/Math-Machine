import { categories, products, carts, cartItems, orders, orderItems, siteConfig, productImages, productReviews, tags, productTags, auditLogs, customers, customerOtps, customerSessions, customerConsents } from "@shared/schema";
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
} from "@shared/types";
import { db } from "./db";
import { eq, and, or, ilike, sql, desc, asc, gt, inArray } from "drizzle-orm";

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
  createProduct(prod: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  getOrCreateCart(sessionId: string): Promise<Cart>;
  getCartItems(cartId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number, personalizationName?: string): Promise<CartItem | undefined>;
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

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { entityType?: string; entityId?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogCount(filters?: { entityType?: string; entityId?: string }): Promise<number>;
  getAuditLogTypeSummary(): Promise<{ entityType: string; count: number; lastChangeAt: Date | null }[]>;
  getAuditLogEntitySummary(entityType: string): Promise<{ entityId: string; entityName: string | null; count: number; lastChangeAt: Date | null; lastAction: string | null }[]>;

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
    const [created] = await db.insert(categories).values(cat).returning();
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

  async getProducts(): Promise<Product[]> {
    const prods = await db.select().from(products).where(eq(products.active, true)).orderBy(products.sortOrder, products.name);
    return this.withReviewStats(prods);
  }

  async getAllProducts(): Promise<Product[]> {
    const prods = await db.select().from(products).orderBy(products.sortOrder, products.name);
    return this.withReviewStats(prods);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const prods = await db.select().from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)))
      .orderBy(products.sortOrder, products.name);
    return this.withReviewStats(prods);
  }

  async getAllProductsByCategory(categoryId: string): Promise<Product[]> {
    const prods = await db.select().from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(products.sortOrder, products.name);
    return this.withReviewStats(prods);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const pattern = `%${query}%`;
    return await db.select().from(products)
      .where(and(
        eq(products.active, true),
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.description, pattern),
        )
      ))
      .orderBy(products.sortOrder, products.name);
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
    return prod;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.id, id));
    return prod;
  }

  async createProduct(prod: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(prod).returning();
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
    const [created] = await db.insert(carts).values({ sessionId }).returning();
    return created;
  }

  async getCartItems(cartId: string): Promise<CartItem[]> {
    return await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [created] = await db.insert(cartItems).values(item).returning();
    return created;
  }

  async updateCartItem(id: string, quantity: number, personalizationName?: string): Promise<CartItem | undefined> {
    const updates: Partial<CartItem> = { quantity };
    if (personalizationName !== undefined) {
      updates.personalizationName = personalizationName;
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
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [created] = await db.insert(orderItems).values(item).returning();
    return created;
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
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
    const [created] = await db.insert(productImages).values(img).returning();
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
    const [created] = await db.insert(productReviews).values(review).returning();
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
    const [created] = await db.insert(tags).values(tag).returning();
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
      await db.insert(productTags).values(tagIds.map(tagId => ({ productId, tagId })));
    }
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
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
    const [customer] = await db.insert(customers).values({ ...data, email: data.email.toLowerCase() }).returning();
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
    await db.insert(customerOtps).values({ email: email.toLowerCase(), otp, expiresAt });
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
    await db.insert(customerSessions).values({ customerId, token, expiresAt });
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
    const [consent] = await db.insert(customerConsents).values(data).returning();
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
}

export const storage = new DatabaseStorage();
