import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { addToCartSchema, updateCartItemSchema, checkoutSchema } from "@shared/routes";
import { insertCategorySchema, insertProductSchema, insertTagSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { execSync } from "child_process";
import { fileStorage, LocalFileStorage } from "./providers/fileStorage";
import { paymentProvider } from "./providers/payment";
import { notificationService } from "./providers/notification";
import { CartService, NotFoundError } from "./services/cartService";
import { OrderService, EmptyCartError } from "./services/orderService";
import { handleAdminLogin, handleAdminLogout, handleAdminCheck, requireAdmin, getAdminUsername } from "./adminAuth";
import { OAuth2Client } from "google-auth-library";

const cartService = new CartService(storage);
const orderService = new OrderService(storage, paymentProvider, notificationService);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

function getSessionId(req: Request, res: Response): string {
  let sessionId = req.cookies?.cart_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("cart_session", sessionId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }
  return sessionId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  if (fileStorage instanceof LocalFileStorage) {
    const express = await import("express");
    app.use("/uploads", express.default.static(fileStorage.getUploadsDir()));
  }

  app.post("/api/upload", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    try {
      const result = await fileStorage.upload(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({ url: result.url });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.get("/api/categories/:slug", async (req, res) => {
    const cat = await storage.getCategoryBySlug(req.params.slug as string);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  });

  app.get("/api/products", async (_req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.get("/api/products/search", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const prods = await storage.searchProducts(q);
    res.json(prods);
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    const prods = await storage.getProductsByCategory(categoryId);
    res.json(prods);
  });

  app.get("/api/products/:slug", async (req, res) => {
    const prod = await storage.getProductBySlug(req.params.slug as string);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(prod);
  });

  app.get("/api/products/:id/images", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const images = await storage.getProductImages(id);
    res.json(images);
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const reviews = await storage.getProductReviews(id);
    res.json(reviews);
  });

  app.get("/api/cart", async (req, res) => {
    const sessionId = getSessionId(req, res);
    const cartDetails = await cartService.getCartDetails(sessionId);
    res.json(cartDetails);
  });

  app.post("/api/cart/items", async (req, res) => {
    try {
      const input = addToCartSchema.parse(req.body);
      const sessionId = getSessionId(req, res);
      const { item, isNew } = await cartService.addItem(
        sessionId, input.productId, input.quantity, input.personalizationName || null
      );
      res.status(isNew ? 201 : 200).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/cart/items/:id", async (req, res) => {
    try {
      const input = updateCartItemSchema.parse(req.body);
      const id = req.params.id as string;
      const result = await cartService.updateItem(id, input.quantity, input.personalizationName);
      if ("deleted" in result) return res.status(204).send();
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/cart/items/:id", async (req, res) => {
    const id = req.params.id as string;
    await cartService.removeItem(id);
    res.status(204).send();
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const input = checkoutSchema.parse(req.body);
      const sessionId = getSessionId(req, res);

      const customer = await getAuthenticatedCustomer(req);
      const customerId = customer?.id || null;

      const result = await orderService.checkout(sessionId, { ...input, customerId });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      if (err instanceof EmptyCartError) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Checkout error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/site-config", async (_req, res) => {
    const configs = await storage.getAllSiteConfigs();
    const result: Record<string, any> = {};
    for (const c of configs) {
      try { result[c.key] = JSON.parse(c.value); } catch { result[c.key] = c.value; }
    }
    res.json(result);
  });

  app.get("/api/site-config/:key", async (req, res) => {
    const config = await storage.getSiteConfig(req.params.key as string);
    if (!config) return res.status(404).json({ message: "Config not found" });
    try {
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch {
      res.json({ key: config.key, value: config.value });
    }
  });

  app.post("/api/site-config/:key", requireAdmin, async (req, res) => {
    try {
      const key = req.params.key as string;
      const value = JSON.stringify(req.body.value);
      const config = await storage.upsertSiteConfig(key, value);
      await storage.createAuditLog({
        entityType: "site-config", entityId: key, entityName: key,
        action: "updated", changes: JSON.stringify({ key }), username: getAdminUsername(req),
      });
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch (err) {
      console.error("Site config save error:", err);
      res.status(500).json({ message: "Failed to save config" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = req.params.id as string;
    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  // ── Admin Auth Routes ──

  app.post("/api/admin/login", handleAdminLogin);
  app.post("/api/admin/logout", handleAdminLogout);
  app.get("/api/admin/check", handleAdminCheck);

  // ── Admin Order Management Routes (protected) ──

  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const filters = { status: status || undefined, search: search || undefined, limit, offset };
      const [ordersList, total] = await Promise.all([
        storage.getAllOrders(filters),
        storage.getOrderCount({ status: filters.status, search: filters.search }),
      ]);
      res.json({ orders: ordersList, total, limit, offset });
    } catch (err) {
      console.error("Admin orders list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const items = await storage.getOrderItems(id);
      res.json({ ...order, items });
    } catch (err) {
      console.error("Admin order detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const orderStatusSchema = z.object({
    status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
  });

  const orderNotesSchema = z.object({
    notes: z.string().default(""),
  });

  app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { status } = orderStatusSchema.parse(req.body);
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const updated = await storage.updateOrderStatus(id, status);
      await storage.createAuditLog({
        entityType: "order",
        entityId: id,
        entityName: `Order #${id.slice(-8).toUpperCase()}`,
        action: "status_updated",
        changes: JSON.stringify({ from: order.status, to: status }),
        username: getAdminUsername(req),
      });
      if (["shipped", "delivered", "cancelled"].includes(status) && order.customerEmail) {
        notificationService.sendOrderStatusUpdate(id, status, order.customerEmail)
          .catch(err => console.error("Status notification error:", err));
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("Admin order status update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/orders/:id/notes", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { notes } = orderNotesSchema.parse(req.body);
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const updated = await storage.updateOrderNotes(id, notes || "");
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("Admin order notes update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin Data Export Routes (protected) ──

  app.get("/api/admin/export/sql", requireAdmin, async (_req, res) => {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return res.status(500).json({ message: "Database not configured" });
      }
      const dump = execSync(`pg_dump "${databaseUrl}" --no-owner --no-privileges --clean --if-exists`, {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", `attachment; filename="turtlelittle_backup_${timestamp}.sql"`);
      res.send(`-- TurtleLittle Full Database Backup\n-- Generated: ${new Date().toISOString()}\n\n${dump}`);
    } catch (err) {
      console.error("SQL export error:", err);
      res.status(500).json({ message: "Failed to export database" });
    }
  });

  app.get("/api/admin/export/csv/:table", requireAdmin, async (req, res) => {
    try {
      const allowedTables = [
        "categories", "products", "tags", "product_tags", "product_images",
        "product_reviews", "orders", "order_items", "carts", "cart_items",
        "site_config", "audit_logs"
      ];
      const table = req.params.table as string;
      if (!allowedTables.includes(table)) {
        return res.status(400).json({ message: "Invalid table name" });
      }
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return res.status(500).json({ message: "Database not configured" });
      }
      const csv = execSync(
        `psql "${databaseUrl}" -c "COPY ${table} TO STDOUT WITH CSV HEADER"`,
        { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${table}_${timestamp}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error("CSV export error:", err);
      res.status(500).json({ message: "Failed to export table" });
    }
  });

  app.get("/api/admin/export/tables", requireAdmin, async (_req, res) => {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return res.status(500).json({ message: "Database not configured" });
      }
      const tables = [
        "categories", "products", "tags", "product_tags", "product_images",
        "product_reviews", "orders", "order_items", "carts", "cart_items",
        "site_config", "audit_logs"
      ];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const result = execSync(
          `psql "${databaseUrl}" -t -c "SELECT COUNT(*) FROM ${table}"`,
          { encoding: "utf-8" }
        ).trim();
        counts[table] = parseInt(result, 10) || 0;
      }
      res.json({ tables: counts });
    } catch (err) {
      console.error("Table list error:", err);
      res.status(500).json({ message: "Failed to get table info" });
    }
  });

  // ── Admin CMS Routes (protected) ──

  app.get("/api/admin/categories", requireAdmin, async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const cat = await storage.createCategory(data);
      await storage.createAuditLog({
        entityType: "category", entityId: cat.id, entityName: cat.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(cat);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A category with that slug already exists" });
      console.error("Create category error:", err);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getCategoryById(id);
      const data = insertCategorySchema.partial().parse(req.body);
      const updated = await storage.updateCategory(id, data);
      if (!updated) return res.status(404).json({ message: "Category not found" });
      await storage.createAuditLog({
        entityType: "category", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify({ before, after: data }), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A category with that slug already exists" });
      console.error("Update category error:", err);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getCategoryById(id);
    await storage.deleteCategory(id);
    await storage.createAuditLog({
      entityType: "category", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify(before), username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.get("/api/admin/products", requireAdmin, async (_req, res) => {
    const prods = await storage.getAllProducts();
    res.json(prods);
  });

  app.get("/api/admin/products/search", requireAdmin, async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const prods = await storage.searchAllProducts(q);
    res.json(prods);
  });

  app.get("/api/admin/products/category/:categoryId", requireAdmin, async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    const prods = await storage.getAllProductsByCategory(categoryId);
    res.json(prods);
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const prod = await storage.createProduct(data);
      await storage.createAuditLog({
        entityType: "product", entityId: prod.id, entityName: prod.name,
        action: "created", changes: JSON.stringify({ name: data.name, slug: data.slug, price: data.price, categoryId: data.categoryId }),
        username: getAdminUsername(req),
      });
      res.status(201).json(prod);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A product with that slug already exists" });
      console.error("Create product error:", err);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getProductById(id);
      const data = insertProductSchema.partial().parse(req.body);
      const updated = await storage.updateProduct(id, data);
      if (!updated) return res.status(404).json({ message: "Product not found" });
      const changedFields: Record<string, { from: any; to: any }> = {};
      if (before) {
        for (const key of Object.keys(data) as (keyof typeof data)[]) {
          if (data[key] !== undefined && (before as any)[key] !== data[key]) {
            changedFields[key] = { from: (before as any)[key], to: data[key] };
          }
        }
      }
      await storage.createAuditLog({
        entityType: "product", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(changedFields), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A product with that slug already exists" });
      console.error("Update product error:", err);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getProductById(id);
    await storage.deleteProduct(id);
    await storage.createAuditLog({
      entityType: "product", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify({ name: before?.name, sku: before?.sku, categoryId: before?.categoryId }),
      username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.post("/api/admin/products/:id/images", requireAdmin, async (req, res) => {
    const productId = req.params.id as string;
    if (!productId) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const img = await storage.createProductImage({ ...req.body, productId });
      res.status(201).json(img);
    } catch (err) {
      console.error("Create product image error:", err);
      res.status(500).json({ message: "Failed to add image" });
    }
  });

  app.delete("/api/admin/products/:productId/images/:imageId", requireAdmin, async (req, res) => {
    const imageId = req.params.imageId as string;
    if (!imageId) return res.status(400).json({ message: "Invalid image ID" });
    await storage.deleteProductImage(imageId);
    res.status(204).send();
  });

  app.post("/api/admin/products/:id/reviews", requireAdmin, async (req, res) => {
    const productId = req.params.id as string;
    if (!productId) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const review = await storage.createProductReview({ ...req.body, productId });
      res.status(201).json(review);
    } catch (err) {
      console.error("Create product review error:", err);
      res.status(500).json({ message: "Failed to add review" });
    }
  });

  app.delete("/api/admin/products/:productId/reviews/:reviewId", requireAdmin, async (req, res) => {
    const reviewId = req.params.reviewId as string;
    if (!reviewId) return res.status(400).json({ message: "Invalid review ID" });
    await storage.deleteProductReview(reviewId);
    res.status(204).send();
  });

  // ── Tag Routes ──

  app.get("/api/admin/tags", requireAdmin, async (_req, res) => {
    const allTags = await storage.getTags();
    res.json(allTags);
  });

  app.post("/api/admin/tags", requireAdmin, async (req, res) => {
    try {
      const data = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(data);
      await storage.createAuditLog({
        entityType: "tag", entityId: tag.id, entityName: tag.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(tag);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag with that name already exists" });
      console.error("Create tag error:", err);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.put("/api/admin/tags/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getTags().then(t => t.find(x => x.id === id));
      const data = insertTagSchema.partial().parse(req.body);
      const updated = await storage.updateTag(id, data);
      if (!updated) return res.status(404).json({ message: "Tag not found" });
      await storage.createAuditLog({
        entityType: "tag", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify({ before, after: data }), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag with that name already exists" });
      console.error("Update tag error:", err);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  app.delete("/api/admin/tags/:id", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getTags().then(t => t.find(x => x.id === id));
    await storage.deleteTag(id);
    await storage.createAuditLog({
      entityType: "tag", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify(before), username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.get("/api/admin/products/:id/tags", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const productTagsList = await storage.getProductTags(id);
    res.json(productTagsList);
  });

  app.put("/api/admin/products/:id/tags", requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const { tagIds } = z.object({ tagIds: z.array(z.string()) }).parse(req.body);
      await storage.setProductTags(id, tagIds);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Set product tags error:", err);
      res.status(500).json({ message: "Failed to set product tags" });
    }
  });

  // ── Audit Log Routes ──

  app.get("/api/admin/audit-logs/type-summary", requireAdmin, async (_req, res) => {
    try {
      const summary = await storage.getAuditLogTypeSummary();
      res.json(summary);
    } catch (err) {
      console.error("Get audit log type summary error:", err);
      res.status(500).json({ message: "Failed to fetch audit log summary" });
    }
  });

  app.get("/api/admin/audit-logs/entity-summary", requireAdmin, async (req, res) => {
    try {
      const entityType = req.query.entityType as string;
      if (!entityType) return res.status(400).json({ message: "entityType is required" });
      const summary = await storage.getAuditLogEntitySummary(entityType);
      res.json(summary);
    } catch (err) {
      console.error("Get audit log entity summary error:", err);
      res.status(500).json({ message: "Failed to fetch entity summary" });
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const [logs, total] = await Promise.all([
        storage.getAuditLogs({ entityType, entityId, limit, offset }),
        storage.getAuditLogCount({ entityType, entityId }),
      ]);
      res.json({ logs, total });
    } catch (err) {
      console.error("Get audit logs error:", err);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ── Customer Authentication ──

  function getCustomerToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }
    return req.cookies?.customer_token;
  }

  async function getAuthenticatedCustomer(req: Request) {
    const token = getCustomerToken(req);
    if (!token) return null;
    return storage.getCustomerBySessionToken(token);
  }

  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createOtp(cleanEmail, otp, expiresAt);
      const result = await notificationService.sendOtpEmail(cleanEmail, otp);

      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code" });
      }

      res.json({ success: true, message: "Verification code sent" });
    } catch (err) {
      console.error("Send OTP error:", err);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and code are required" });
      }
      const cleanEmail = email.trim().toLowerCase();

      const valid = await storage.verifyOtp(cleanEmail, otp);
      if (!valid) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      let customer = await storage.getCustomerByEmail(cleanEmail);
      if (!customer) {
        customer = await storage.createCustomer({ email: cleanEmail });
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("customer_token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      });

      res.json({ success: true, customer, token });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(customer);
  });

  app.patch("/api/auth/profile", async (req: Request, res: Response) => {
    try {
      const customer = await getAuthenticatedCustomer(req);
      if (!customer) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allowedFields = ["name", "phone", "shippingAddress", "shippingCity", "shippingState", "shippingPincode"];
      const updates: Record<string, string> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const updated = await storage.updateCustomer(customer.id, updates);
      res.json(updated);
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = getCustomerToken(req);
    if (token) {
      await storage.deleteCustomerSession(token);
    }
    res.clearCookie("customer_token", { path: "/" });
    res.json({ success: true });
  });

  app.get("/api/auth/orders", async (req: Request, res: Response) => {
    try {
      const customer = await getAuthenticatedCustomer(req);
      if (!customer) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const customerOrders = await storage.getOrdersByCustomerId(customer.id);

      const ordersWithItems = await Promise.all(
        customerOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );

      res.json(ordersWithItems);
    } catch (err) {
      console.error("Get customer orders error:", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Google OAuth routes
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential is required" });
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return res.status(500).json({ message: "Google Sign-In not configured" });
      }

      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(400).json({ message: "Invalid Google credential" });
      }

      const { sub: googleId, email, name, picture } = payload;
      if (!email) {
        return res.status(400).json({ message: "Email not available from Google" });
      }

      let customer = await storage.getCustomerByGoogleId(googleId);
      if (!customer) {
        customer = await storage.getCustomerByEmail(email);
        if (customer) {
          customer = await storage.updateCustomer(customer.id, { googleId, avatarUrl: picture, name: customer.name || name });
        } else {
          customer = await storage.createCustomer({ email, name, googleId, avatarUrl: picture });
        }
      }
      if (!customer) {
        return res.status(500).json({ message: "Failed to create account" });
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("customer_token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      });

      res.json({ success: true, customer, token });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  return httpServer;
}
