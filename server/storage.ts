import {
  categories, products, carts, cartItems, orders, orderItems, siteConfig,
  type Category, type InsertCategory,
  type Product, type InsertProduct,
  type Cart, type InsertCart,
  type CartItem, type InsertCartItem,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type SiteConfig,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(cat: InsertCategory): Promise<Category>;

  getProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: number): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  getProductById(id: number): Promise<Product | undefined>;
  createProduct(prod: InsertProduct): Promise<Product>;

  getOrCreateCart(sessionId: string): Promise<Cart>;
  getCartItems(cartId: number): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: number, quantity: number, personalizationName?: string): Promise<CartItem | undefined>;
  removeCartItem(id: number): Promise<void>;
  clearCart(cartId: number): Promise<void>;

  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderById(id: number): Promise<Order | undefined>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  updateOrderPayment(orderId: number, paymentId: string, paymentStatus: string): Promise<Order | undefined>;

  getSiteConfig(key: string): Promise<SiteConfig | undefined>;
  getAllSiteConfigs(): Promise<SiteConfig[]>;
  upsertSiteConfig(key: string, value: string): Promise<SiteConfig>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug));
    return cat;
  }

  async createCategory(cat: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(cat).returning();
    return created;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.active, true)).orderBy(products.sortOrder);
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    return await db.select().from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)))
      .orderBy(products.sortOrder);
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.slug, slug));
    return prod;
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.id, id));
    return prod;
  }

  async createProduct(prod: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(prod).returning();
    return created;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const [existing] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    if (existing) return existing;
    const [created] = await db.insert(carts).values({ sessionId }).returning();
    return created;
  }

  async getCartItems(cartId: number): Promise<CartItem[]> {
    return await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [created] = await db.insert(cartItems).values(item).returning();
    return created;
  }

  async updateCartItem(id: number, quantity: number, personalizationName?: string): Promise<CartItem | undefined> {
    const updates: Partial<CartItem> = { quantity };
    if (personalizationName !== undefined) {
      updates.personalizationName = personalizationName;
    }
    const [updated] = await db.update(cartItems).set(updates).where(eq(cartItems.id, id)).returning();
    return updated;
  }

  async removeCartItem(id: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(cartId: number): Promise<void> {
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

  async getOrderById(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async updateOrderPayment(orderId: number, paymentId: string, paymentStatus: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ paymentId, paymentStatus, status: paymentStatus === "paid" ? "confirmed" : "pending" })
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
}

export const storage = new DatabaseStorage();
