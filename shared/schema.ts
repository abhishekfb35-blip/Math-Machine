import { pgTable, text, timestamp, integer, boolean, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(),
  mrp: integer("mrp"),
  imageUrl: text("image_url").notNull(),
  categoryId: text("category_id").notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const carts = pgTable("carts", {
  id: text("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: text("id").primaryKey(),
  cartId: text("cart_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  personalizationName: text("personalization_name"),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id"),
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
  razorpayOrderId: text("razorpay_order_id"),
  paymentStatus: text("payment_status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  productPrice: integer("product_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  personalizationName: text("personalization_name"),
  isFree: boolean("is_free").default(false),
});

export const siteConfig = pgTable("site_config", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const productImages = pgTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  amzReviewDate: text("amz_review_date"),
  verifiedPurchase: boolean("verified_purchase").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const productTags = pgTable("product_tags", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  tagId: text("tag_id").notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCartSchema = createInsertSchema(carts).omit({ id: true, createdAt: true });
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true });
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  entityName: text("entity_name"),
  action: text("action").notNull(),
  changes: text("changes"),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  shippingAddress: text("shipping_address"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  shippingPincode: text("shipping_pincode"),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerOtps = pgTable("customer_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerSessions = pgTable("customer_sessions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerConsents = pgTable("customer_consents", {
  id: text("id").primaryKey(),
  customerId: text("customer_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  consentType: text("consent_type").notNull(),
  consentGiven: boolean("consent_given").notNull(),
  discountCode: text("discount_code"),
  discountUsed: boolean("discount_used").default(false),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  pageUrl: text("page_url"),
  consentMethod: text("consent_method"),
  consentText: text("consent_text"),
  consentedAt: timestamp("consented_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const insertCustomerConsentSchema = createInsertSchema(customerConsents).omit({ id: true, consentedAt: true, revokedAt: true });

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertSiteConfigSchema = createInsertSchema(siteConfig).omit({ id: true });
export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductReviewSchema = createInsertSchema(productReviews).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertProductTagSchema = createInsertSchema(productTags).omit({ id: true });

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
  Tag, InsertTag,
  ProductTag, InsertProductTag,
  AuditLog, InsertAuditLog,
  Customer, InsertCustomer,
  CustomerConsent, InsertCustomerConsent,
} from "./types";
