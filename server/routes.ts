import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { addToCartSchema, updateCartItemSchema, checkoutSchema } from "@shared/routes";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { fileStorage, LocalFileStorage } from "./providers/fileStorage";
import { paymentProvider } from "./providers/payment";
import { notificationService } from "./providers/notification";
import { CartService, NotFoundError } from "./services/cartService";
import { OrderService, EmptyCartError } from "./services/orderService";

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

  app.post("/api/upload", upload.single("image"), async (req: Request, res: Response) => {
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
    const cat = await storage.getCategoryBySlug(req.params.slug);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  });

  app.get("/api/products", async (_req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) return res.status(400).json({ message: "Invalid category ID" });
    const prods = await storage.getProductsByCategory(categoryId);
    res.json(prods);
  });

  app.get("/api/products/:slug", async (req, res) => {
    const prod = await storage.getProductBySlug(req.params.slug);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(prod);
  });

  app.get("/api/products/:id/images", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
    const images = await storage.getProductImages(id);
    res.json(images);
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
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
      const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
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
    const config = await storage.getSiteConfig(req.params.key);
    if (!config) return res.status(404).json({ message: "Config not found" });
    try {
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch {
      res.json({ key: config.key, value: config.value });
    }
  });

  app.post("/api/site-config/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const value = JSON.stringify(req.body.value);
      const config = await storage.upsertSiteConfig(key, value);
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch (err) {
      console.error("Site config save error:", err);
      res.status(500).json({ message: "Failed to save config" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  return httpServer;
}
