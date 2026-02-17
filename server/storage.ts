import { categories, products, carts, cartItems, orders, orderItems, siteConfig, productImages, productReviews, tags, productTags } from "@shared/schema";
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
} from "@shared/types";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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

  getSiteConfig(key: string): Promise<SiteConfig | undefined>;
  getAllSiteConfigs(): Promise<SiteConfig[]>;
  upsertSiteConfig(key: string, value: string): Promise<SiteConfig>;

  getProductImages(productId: string): Promise<ProductImage[]>;
  createProductImage(img: InsertProductImage): Promise<ProductImage>;
  deleteProductImage(id: string): Promise<void>;

  getProductReviews(productId: string): Promise<ProductReview[]>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  deleteProductReview(id: string): Promise<void>;

  getTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<void>;

  getProductTags(productId: string): Promise<Tag[]>;
  setProductTags(productId: string, tagIds: string[]): Promise<void>;
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

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.active, true)).orderBy(products.sortOrder);
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.sortOrder);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return await db.select().from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)))
      .orderBy(products.sortOrder);
  }

  async getAllProductsByCategory(categoryId: string): Promise<Product[]> {
    return await db.select().from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(products.sortOrder);
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

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db.select().from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(productReviews.rating);
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const [created] = await db.insert(productReviews).values(review).returning();
    return created;
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
}

export const storage = new DatabaseStorage();
