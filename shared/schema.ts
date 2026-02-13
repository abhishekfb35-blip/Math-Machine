import { pgTable, text, serial, timestamp, integer, boolean, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(),
  mrp: integer("mrp"),
  imageUrl: text("image_url").notNull(),
  categoryId: integer("category_id").notNull(),
  amazonAsin: text("amazon_asin"),
  color: text("color"),
  material: text("material"),
  gsm: integer("gsm"),
  dimensions: text("dimensions"),
  weightGrams: integer("weight_grams"),
  itemsInSet: integer("items_in_set").default(1),
  specialFeatures: text("special_features"),
  bulletPoints: text("bullet_points"),
  searchKeywords: text("search_keywords"),
  productType: text("product_type").default("towel"),
  audience: text("audience").default("kids"),
  active: boolean("active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  personalizationName: text("personalization_name"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingState: text("shipping_state").notNull(),
  shippingPincode: text("shipping_pincode").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"),
  paymentId: text("payment_id"),
  paymentStatus: text("payment_status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  productPrice: integer("product_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  personalizationName: text("personalization_name"),
  isFree: boolean("is_free").default(false),
});

export const siteConfig = pgTable("site_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
});

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  reviewDate: text("review_date"),
  verifiedPurchase: boolean("verified_purchase").default(false),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCartSchema = createInsertSchema(carts).omit({ id: true, createdAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertSiteConfigSchema = createInsertSchema(siteConfig).omit({ id: true });
export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true });
export const insertProductReviewSchema = createInsertSchema(productReviews).omit({ id: true });

export type {
  Category, InsertCategory,
  Product, InsertProduct,
  Cart, InsertCart,
  CartItem, InsertCartItem,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  SiteConfig, InsertSiteConfig,
  ProductImage, InsertProductImage,
  ProductReview, InsertProductReview,
} from "./types";
