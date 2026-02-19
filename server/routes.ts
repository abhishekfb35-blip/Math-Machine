import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { addToCartSchema, updateCartItemSchema, checkoutSchema } from "@shared/routes";
import { insertCategorySchema, insertProductSchema, insertTagSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { fileStorage, LocalFileStorage } from "./providers/fileStorage";
import { paymentProvider } from "./providers/payment";
import { notificationService } from "./providers/notification";
import { CartService, NotFoundError } from "./services/cartService";
import { OrderService, EmptyCartError } from "./services/orderService";
import { handleAdminLogin, handleAdminLogout, handleAdminCheck, requireAdmin, getAdminUsername } from "./adminAuth";

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
      const result = await orderService.checkout(sessionId, input);
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

  return httpServer;
}
