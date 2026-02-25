import type { Express, Request, Response } from "express";
import type { Server } from "http";
import compression from "compression";
import { storage } from "./storage";
import { addToCartSchema, updateCartItemSchema, checkoutSchema } from "@shared/routes";
import { insertCategorySchema, insertProductSchema, insertTagSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { execSync } from "child_process";
import { fileStorage, LocalFileStorage } from "./providers/fileStorage";
import { codProvider, getRazorpayProvider } from "./providers/payment";
import { notificationService } from "./providers/notification";
import { CartService, NotFoundError } from "./services/cartService";
import { OrderService, EmptyCartError } from "./services/orderService";
import { handleAdminLogin, handleAdminLogout, handleAdminCheck, requireAdmin, getAdminUsername } from "./adminAuth";
import { OAuth2Client } from "google-auth-library";

const cartService = new CartService(storage);
const orderService = new OrderService(storage, codProvider, notificationService);

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

  app.use(compression());

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

  app.get("/robots.txt", (_req, res) => {
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout
Disallow: /cart
Disallow: /order/
Disallow: /signin
Disallow: /account

Sitemap: https://turtlelittle.com/sitemap.xml
`;
    res.set("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      const products = await storage.getProducts();
      const baseUrl = "https://turtlelittle.com";
      const today = new Date().toISOString().split("T")[0];

      const staticPages = [
        { loc: "/", priority: "1.0", changefreq: "daily" },
        { loc: "/shop", priority: "0.9", changefreq: "daily" },
        { loc: "/about", priority: "0.5", changefreq: "monthly" },
        { loc: "/terms", priority: "0.3", changefreq: "yearly" },
        { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
        { loc: "/refund-policy", priority: "0.3", changefreq: "yearly" },
        { loc: "/shipping", priority: "0.3", changefreq: "yearly" },
      ];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const page of staticPages) {
        xml += `  <url>\n    <loc>${baseUrl}${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
      }

      for (const cat of categories) {
        xml += `  <url>\n    <loc>${baseUrl}/category/${cat.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      for (const product of products) {
        if (!product.active) continue;
        const lastmod = product.updatedAt ? new Date(product.updatedAt).toISOString().split("T")[0] : today;
        xml += `  <url>\n    <loc>${baseUrl}/product/${product.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;
      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      res.status(500).send("Error generating sitemap");
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

  app.get("/api/razorpay/key", (_req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return res.json({ available: false });
    }
    res.json({ available: true, keyId });
  });

  app.post("/api/razorpay/create-order", async (req, res) => {
    try {
      const razorpay = getRazorpayProvider();
      if (!razorpay) {
        return res.status(503).json({ message: "Online payment is not configured" });
      }

      const sessionId = getSessionId(req, res);
      const cart = await storage.getOrCreateCart(sessionId);
      const items = await storage.getCartItems(cart.id);

      if (items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProductById(item.productId);
          return { ...item, product };
        })
      );

      const { calculateDiscount } = await import("./services/discountService");
      const priceItems = itemsWithProducts
        .filter(i => i.product)
        .map(i => ({ price: i.product!.price, quantity: i.quantity }));
      const pricing = calculateDiscount(priceItems);

      const result = await razorpay.createPaymentOrder({
        orderId: `cart_${cart.id}`,
        amount: pricing.total,
        currency: "INR",
        customerName: req.body.customerName || "",
        customerEmail: req.body.customerEmail || "",
        customerPhone: req.body.customerPhone || "",
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to create payment order" });
      }

      res.json({
        razorpayOrderId: result.razorpayOrderId,
        amount: pricing.total,
        currency: "INR",
      });
    } catch (err) {
      console.error("Razorpay create order error:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const { paymentMethod, razorpayPaymentId, razorpayOrderId, razorpaySignature, ...checkoutData } = req.body;
      const input = checkoutSchema.parse(checkoutData);
      const sessionId = getSessionId(req, res);

      const customer = await getAuthenticatedCustomer(req);
      const customerId = customer?.id || null;

      if (paymentMethod === "razorpay") {
        const razorpay = getRazorpayProvider();
        if (!razorpay) {
          return res.status(503).json({ message: "Online payment is not configured" });
        }

        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
          return res.status(400).json({ message: "Missing payment details" });
        }

        const verification = await razorpay.verifyPayment(razorpayPaymentId, razorpaySignature, razorpayOrderId);
        if (!verification.success) {
          return res.status(400).json({ message: verification.error || "Payment verification failed" });
        }

        const razorpayOrderService = new OrderService(storage, razorpay, notificationService);
        const result = await razorpayOrderService.checkoutWithPayment(sessionId, {
          ...input,
          customerId,
          paymentId: razorpayPaymentId,
          razorpayOrderId,
          paymentStatus: "paid",
        });
        return res.status(201).json(result);
      }

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

  // ── Admin Deploy Check (Code Health) ──

  app.get("/api/admin/deploy-check", requireAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const distDir = path.resolve(import.meta.dirname, "..", "dist");
      const publicDir = path.resolve(distDir, "public");
      const serverBundle = path.resolve(distDir, "index.cjs");
      const srcDir = path.resolve(import.meta.dirname);
      const clientDir = path.resolve(import.meta.dirname, "..", "client");
      const sharedDir = path.resolve(import.meta.dirname, "..", "shared");

      const results: {
        buildExists: boolean;
        buildTimestamp: string | null;
        buildAgeMinutes: number | null;
        sourceNewerThanBuild: boolean;
        newestSourceFile: string | null;
        newestSourceTimestamp: string | null;
        routeChecks: { route: string; found: boolean }[];
        staticFileChecks: { file: string; exists: boolean; size?: number }[];
        overallStatus: "pass" | "warn" | "fail";
        issues: string[];
      } = {
        buildExists: false,
        buildTimestamp: null,
        buildAgeMinutes: null,
        sourceNewerThanBuild: false,
        newestSourceFile: null,
        newestSourceTimestamp: null,
        routeChecks: [],
        staticFileChecks: [],
        overallStatus: "pass",
        issues: [],
      };

      if (!fs.existsSync(serverBundle)) {
        results.issues.push("Production bundle dist/index.cjs does not exist. Run npm run build.");
        results.overallStatus = "fail";
        return res.json(results);
      }

      results.buildExists = true;
      const buildStat = fs.statSync(serverBundle);
      results.buildTimestamp = buildStat.mtime.toISOString();
      results.buildAgeMinutes = Math.round((Date.now() - buildStat.mtime.getTime()) / 60000);

      function getNewestFileTime(dir: string): { file: string; mtime: Date } | null {
        let newest: { file: string; mtime: Date } | null = null;
        try {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.name === "node_modules" || item.name === "dist" || item.name === ".git") continue;
            if (item.isDirectory()) {
              const sub = getNewestFileTime(fullPath);
              if (sub && (!newest || sub.mtime > newest.mtime)) {
                newest = sub;
              }
            } else if (item.isFile() && /\.(ts|tsx|css|html|json)$/.test(item.name)) {
              const stat = fs.statSync(fullPath);
              if (!newest || stat.mtime > newest.mtime) {
                newest = { file: fullPath, mtime: stat.mtime };
              }
            }
          }
        } catch {}
        return newest;
      }

      const newestServer = getNewestFileTime(srcDir);
      const newestClient = getNewestFileTime(clientDir);
      const newestShared = getNewestFileTime(sharedDir);
      const candidates = [newestServer, newestClient, newestShared].filter(Boolean) as { file: string; mtime: Date }[];
      const newestSource = candidates.length > 0
        ? candidates.reduce((a, b) => (a.mtime > b.mtime ? a : b), candidates[0])
        : null;

      if (newestSource) {
        const projectRoot = path.resolve(import.meta.dirname, "..");
        results.newestSourceFile = newestSource.file.replace(projectRoot + "/", "");
        results.newestSourceTimestamp = newestSource.mtime.toISOString();
        results.sourceNewerThanBuild = newestSource.mtime > buildStat.mtime;
        if (results.sourceNewerThanBuild) {
          results.issues.push(`Source file "${results.newestSourceFile}" is newer than the build. Rebuild needed.`);
          results.overallStatus = "warn";
        }
      }

      const bundleContent = fs.readFileSync(serverBundle, "utf-8");
      const criticalRoutes = [
        { route: "/sitemap.xml", searchTerm: "sitemap.xml" },
        { route: "/robots.txt", searchTerm: "robots.txt" },
        { route: "/api/categories", searchTerm: '"/api/categories"' },
        { route: "/api/products", searchTerm: '"/api/products"' },
        { route: "/api/cart", searchTerm: '"/api/cart"' },
        { route: "/api/checkout", searchTerm: "checkout" },
        { route: "/api/auth", searchTerm: "/api/auth" },
        { route: "/api/admin/orders", searchTerm: "/api/admin/orders" },
        { route: "Razorpay integration", searchTerm: "razorpay" },
        { route: "/api/admin/deploy-check", searchTerm: "deploy-check" },
        { route: "/api/admin/data-check", searchTerm: "data-check" },
      ];

      for (const check of criticalRoutes) {
        const found = bundleContent.toLowerCase().includes(check.searchTerm.toLowerCase());
        results.routeChecks.push({ route: check.route, found });
        if (!found) {
          results.issues.push(`Route "${check.route}" not found in production bundle.`);
          results.overallStatus = "fail";
        }
      }

      const criticalFiles = [
        "index.html", "favicon.png", "manifest.json", "sw.js",
      ];

      for (const file of criticalFiles) {
        const filePath = path.resolve(publicDir, file);
        const exists = fs.existsSync(filePath);
        const size = exists ? fs.statSync(filePath).size : undefined;
        results.staticFileChecks.push({ file, exists, size });
        if (!exists) {
          results.issues.push(`Static file "${file}" missing from dist/public/.`);
          results.overallStatus = "fail";
        }
      }

      const assetDirs = ["assets", "images"];
      for (const dir of assetDirs) {
        const dirPath = path.resolve(publicDir, dir);
        const exists = fs.existsSync(dirPath);
        results.staticFileChecks.push({ file: `${dir}/`, exists });
        if (!exists) {
          results.issues.push(`Directory "${dir}/" missing from dist/public/.`);
          results.overallStatus = "fail";
        }
      }

      res.json(results);
    } catch (err) {
      console.error("Deploy check error:", err);
      res.status(500).json({ message: "Failed to run deploy check" });
    }
  });

  // ── Admin Data/Schema Check (Database Health) ──

  app.get("/api/admin/data-check", requireAdmin, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const environment = process.env.NODE_ENV || "development";

      const expectedSchema: Record<string, { column: string; type: string; nullable: boolean }[]> = {
        categories: [
          { column: "id", type: "text", nullable: false },
          { column: "name", type: "text", nullable: false },
          { column: "slug", type: "text", nullable: false },
          { column: "description", type: "text", nullable: true },
          { column: "image_url", type: "text", nullable: true },
          { column: "sort_order", type: "integer", nullable: true },
        ],
        products: [
          { column: "id", type: "text", nullable: false },
          { column: "sku", type: "text", nullable: true },
          { column: "name", type: "text", nullable: false },
          { column: "slug", type: "text", nullable: false },
          { column: "description", type: "text", nullable: true },
          { column: "price", type: "integer", nullable: false },
          { column: "mrp", type: "integer", nullable: true },
          { column: "image_url", type: "text", nullable: false },
          { column: "category_id", type: "text", nullable: false },
          { column: "amazon_asin", type: "text", nullable: true },
          { column: "color", type: "text", nullable: true },
          { column: "material", type: "text", nullable: true },
          { column: "gsm", type: "integer", nullable: true },
          { column: "dimensions", type: "text", nullable: true },
          { column: "weight_grams", type: "integer", nullable: true },
          { column: "items_in_set", type: "integer", nullable: true },
          { column: "special_features", type: "text", nullable: true },
          { column: "bullet_points", type: "text", nullable: true },
          { column: "search_keywords", type: "text", nullable: true },
          { column: "product_type", type: "text", nullable: true },
          { column: "audience", type: "text", nullable: true },
          { column: "active", type: "boolean", nullable: true },
          { column: "sort_order", type: "integer", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
          { column: "updated_at", type: "timestamp without time zone", nullable: true },
        ],
        product_images: [
          { column: "id", type: "text", nullable: false },
          { column: "product_id", type: "text", nullable: false },
          { column: "image_url", type: "text", nullable: false },
          { column: "sort_order", type: "integer", nullable: true },
          { column: "is_primary", type: "boolean", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
          { column: "updated_at", type: "timestamp without time zone", nullable: true },
        ],
        product_reviews: [
          { column: "id", type: "text", nullable: false },
          { column: "product_id", type: "text", nullable: false },
          { column: "reviewer_name", type: "text", nullable: false },
          { column: "rating", type: "integer", nullable: false },
          { column: "title", type: "text", nullable: true },
          { column: "body", type: "text", nullable: false },
          { column: "amz_review_date", type: "text", nullable: true },
          { column: "verified_purchase", type: "boolean", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
        ],
        tags: [
          { column: "id", type: "text", nullable: false },
          { column: "name", type: "text", nullable: false },
          { column: "description", type: "text", nullable: true },
        ],
        product_tags: [
          { column: "id", type: "text", nullable: false },
          { column: "product_id", type: "text", nullable: false },
          { column: "tag_id", type: "text", nullable: false },
        ],
        carts: [
          { column: "id", type: "text", nullable: false },
          { column: "session_id", type: "character varying", nullable: false },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
        ],
        cart_items: [
          { column: "id", type: "text", nullable: false },
          { column: "cart_id", type: "text", nullable: false },
          { column: "product_id", type: "text", nullable: false },
          { column: "quantity", type: "integer", nullable: false },
          { column: "personalization_name", type: "text", nullable: true },
        ],
        orders: [
          { column: "id", type: "text", nullable: false },
          { column: "customer_id", type: "text", nullable: true },
          { column: "customer_name", type: "text", nullable: false },
          { column: "customer_email", type: "text", nullable: false },
          { column: "customer_phone", type: "text", nullable: false },
          { column: "shipping_address", type: "text", nullable: false },
          { column: "shipping_city", type: "text", nullable: false },
          { column: "shipping_state", type: "text", nullable: false },
          { column: "shipping_pincode", type: "text", nullable: false },
          { column: "subtotal", type: "integer", nullable: false },
          { column: "discount", type: "integer", nullable: false },
          { column: "total", type: "integer", nullable: false },
          { column: "status", type: "text", nullable: false },
          { column: "payment_id", type: "text", nullable: true },
          { column: "razorpay_order_id", type: "text", nullable: true },
          { column: "payment_status", type: "text", nullable: true },
          { column: "notes", type: "text", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
          { column: "updated_at", type: "timestamp without time zone", nullable: true },
        ],
        order_items: [
          { column: "id", type: "text", nullable: false },
          { column: "order_id", type: "text", nullable: false },
          { column: "product_id", type: "text", nullable: false },
          { column: "product_name", type: "text", nullable: false },
          { column: "product_price", type: "integer", nullable: false },
          { column: "quantity", type: "integer", nullable: false },
          { column: "personalization_name", type: "text", nullable: true },
          { column: "is_free", type: "boolean", nullable: true },
        ],
        site_config: [
          { column: "id", type: "text", nullable: false },
          { column: "key", type: "text", nullable: false },
          { column: "value", type: "text", nullable: false },
        ],
        audit_logs: [
          { column: "id", type: "text", nullable: false },
          { column: "entity_type", type: "text", nullable: false },
          { column: "entity_id", type: "text", nullable: false },
          { column: "entity_name", type: "text", nullable: true },
          { column: "action", type: "text", nullable: false },
          { column: "changes", type: "text", nullable: true },
          { column: "username", type: "text", nullable: false },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
        ],
        customers: [
          { column: "id", type: "text", nullable: false },
          { column: "email", type: "text", nullable: false },
          { column: "name", type: "text", nullable: true },
          { column: "phone", type: "text", nullable: true },
          { column: "shipping_address", type: "text", nullable: true },
          { column: "shipping_city", type: "text", nullable: true },
          { column: "shipping_state", type: "text", nullable: true },
          { column: "shipping_pincode", type: "text", nullable: true },
          { column: "google_id", type: "text", nullable: true },
          { column: "avatar_url", type: "text", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
          { column: "updated_at", type: "timestamp without time zone", nullable: true },
        ],
        customer_otps: [
          { column: "id", type: "text", nullable: false },
          { column: "email", type: "text", nullable: false },
          { column: "otp", type: "text", nullable: false },
          { column: "expires_at", type: "timestamp without time zone", nullable: false },
          { column: "used", type: "boolean", nullable: true },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
        ],
        customer_sessions: [
          { column: "id", type: "text", nullable: false },
          { column: "customer_id", type: "text", nullable: false },
          { column: "token", type: "text", nullable: false },
          { column: "expires_at", type: "timestamp without time zone", nullable: false },
          { column: "created_at", type: "timestamp without time zone", nullable: true },
        ],
      };

      const schemaQuery = await pool.query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      const actualSchema: Record<string, { column: string; type: string; nullable: boolean }[]> = {};
      for (const row of schemaQuery.rows) {
        if (!actualSchema[row.table_name]) {
          actualSchema[row.table_name] = [];
        }
        actualSchema[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        });
      }

      const structureChecks: {
        table: string;
        status: "pass" | "warn" | "fail" | "missing_table";
        expectedColumns: { column: string; type: string; nullable: boolean }[];
        actualColumns: { column: string; type: string; nullable: boolean }[];
        missingColumns: string[];
        extraColumns: string[];
        typeMismatches: { column: string; expected: string; actual: string }[];
      }[] = [];

      for (const [tableName, expectedCols] of Object.entries(expectedSchema)) {
        const actual = actualSchema[tableName];
        if (!actual) {
          structureChecks.push({
            table: tableName,
            status: "missing_table",
            expectedColumns: expectedCols,
            actualColumns: [],
            missingColumns: expectedCols.map(c => c.column),
            extraColumns: [],
            typeMismatches: [],
          });
          continue;
        }

        const actualMap = new Map(actual.map(c => [c.column, c]));
        const expectedMap = new Map(expectedCols.map(c => [c.column, c]));
        const missingColumns: string[] = [];
        const extraColumns: string[] = [];
        const typeMismatches: { column: string; expected: string; actual: string }[] = [];

        for (const exp of expectedCols) {
          const act = actualMap.get(exp.column);
          if (!act) {
            missingColumns.push(exp.column);
          } else if (act.type !== exp.type) {
            typeMismatches.push({ column: exp.column, expected: exp.type, actual: act.type });
          }
        }

        for (const act of actual) {
          if (!expectedMap.has(act.column)) {
            extraColumns.push(act.column);
          }
        }

        const status = missingColumns.length > 0 || typeMismatches.length > 0 ? "fail" : extraColumns.length > 0 ? "warn" : "pass";
        structureChecks.push({ table: tableName, status, expectedColumns: expectedCols, actualColumns: actual, missingColumns, extraColumns, typeMismatches });
      }

      const tableCounts: { table: string; count: number; status: "pass" | "warn" | "empty" }[] = [];
      const mustHaveData = ["categories", "products"];

      for (const tableName of Object.keys(expectedSchema)) {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
          const count = parseInt(countResult.rows[0].cnt, 10);
          const status = count === 0 && mustHaveData.includes(tableName) ? "empty" : count === 0 ? "warn" : "pass";
          tableCounts.push({ table: tableName, count, status });
        } catch {
          tableCounts.push({ table: tableName, count: -1, status: "warn" });
        }
      }

      const integrityIssues: string[] = [];

      const orphanedProducts = await pool.query(`
        SELECT p.id, p.name FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE c.id IS NULL
      `);
      if (orphanedProducts.rows.length > 0) {
        integrityIssues.push(`${orphanedProducts.rows.length} product(s) reference non-existent categories: ${orphanedProducts.rows.map(r => r.name).join(", ")}`);
      }

      const productsNoImages = await pool.query(`
        SELECT p.id, p.name FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE pi.id IS NULL AND p.active = true
      `);
      if (productsNoImages.rows.length > 0) {
        integrityIssues.push(`${productsNoImages.rows.length} active product(s) have no additional images: ${productsNoImages.rows.slice(0, 5).map(r => r.name).join(", ")}${productsNoImages.rows.length > 5 ? "..." : ""}`);
      }

      const orphanedCartItems = await pool.query(`
        SELECT ci.id FROM cart_items ci
        LEFT JOIN carts c ON ci.cart_id = c.id
        WHERE c.id IS NULL
      `);
      if (orphanedCartItems.rows.length > 0) {
        integrityIssues.push(`${orphanedCartItems.rows.length} orphaned cart item(s) with no parent cart.`);
      }

      const orphanedOrderItems = await pool.query(`
        SELECT oi.id FROM order_items oi
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE o.id IS NULL
      `);
      if (orphanedOrderItems.rows.length > 0) {
        integrityIssues.push(`${orphanedOrderItems.rows.length} orphaned order item(s) with no parent order.`);
      }

      const configKeys = await pool.query(`SELECT key FROM site_config`);
      const existingKeys = configKeys.rows.map(r => r.key);
      const expectedConfigKeys = ["header", "hero", "homepageCollections"];
      const missingConfigKeys = expectedConfigKeys.filter(k => !existingKeys.includes(k));

      const overallStatus = structureChecks.some(c => c.status === "fail" || c.status === "missing_table")
        ? "fail"
        : structureChecks.some(c => c.status === "warn") || tableCounts.some(c => c.status === "empty") || integrityIssues.length > 0
        ? "warn"
        : "pass";

      res.json({
        environment,
        timestamp: new Date().toISOString(),
        overallStatus,
        structureChecks,
        tableCounts,
        integrityIssues,
        siteConfig: { existingKeys, missingConfigKeys },
      });
    } catch (err) {
      console.error("Data check error:", err);
      res.status(500).json({ message: "Failed to run data check" });
    }
  });

  // ── Admin SEO Audit ──

  app.get("/api/admin/seo-audit", requireAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const products = await storage.getProducts();
      const categories = await storage.getCategories();
      const { pool } = await import("./db");

      interface AuditIssue {
        severity: "error" | "warning" | "info";
        message: string;
        entity?: string;
      }

      interface AuditCategory {
        name: string;
        score: number;
        maxScore: number;
        passed: number;
        total: number;
        issues: AuditIssue[];
      }

      const activeProducts = products.filter(p => p.active);
      const inactiveProducts = products.filter(p => !p.active);

      const metaTags: AuditCategory = { name: "Meta Tags", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };

      for (const p of activeProducts) {
        metaTags.total++;
        metaTags.maxScore += 3;
        let points = 0;

        if (!p.description || p.description.trim().length === 0) {
          metaTags.issues.push({ severity: "error", message: `Missing description (used as meta description)`, entity: p.name });
        } else {
          points++;
          if (p.description.length < 50) {
            metaTags.issues.push({ severity: "warning", message: `Description too short (${p.description.length} chars, min 50)`, entity: p.name });
          } else {
            points++;
          }
          if (p.description.length > 300) {
            metaTags.issues.push({ severity: "info", message: `Description very long (${p.description.length} chars), may be truncated in search results`, entity: p.name });
          } else {
            points++;
          }
        }
        metaTags.score += points;
      }

      for (const c of categories) {
        metaTags.total++;
        metaTags.maxScore += 1;
        if (!c.description || c.description.trim().length === 0) {
          metaTags.issues.push({ severity: "warning", message: `Category missing description`, entity: c.name });
        } else {
          metaTags.score++;
        }
      }
      metaTags.passed = metaTags.total - metaTags.issues.filter(i => i.severity === "error").length;

      const urls: AuditCategory = { name: "URLs & Slugs", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      const productSlugs = new Map<string, string[]>();

      for (const p of activeProducts) {
        urls.total++;
        urls.maxScore += 2;
        let points = 0;

        if (!p.slug) {
          urls.issues.push({ severity: "error", message: `Missing slug`, entity: p.name });
        } else {
          if (!slugRegex.test(p.slug)) {
            urls.issues.push({ severity: "warning", message: `Slug not URL-friendly: "${p.slug}"`, entity: p.name });
          } else {
            points++;
          }
          const existing = productSlugs.get(p.slug) || [];
          existing.push(p.name);
          productSlugs.set(p.slug, existing);
          points++;
        }
        urls.score += points;
      }

      for (const [slug, names] of productSlugs) {
        if (names.length > 1) {
          urls.issues.push({ severity: "error", message: `Duplicate product slug "${slug}" used by: ${names.join(", ")}` });
          urls.score -= names.length;
        }
      }

      const catSlugs = new Map<string, string[]>();
      for (const c of categories) {
        urls.total++;
        urls.maxScore += 1;
        if (!c.slug) {
          urls.issues.push({ severity: "error", message: `Category missing slug`, entity: c.name });
        } else {
          if (!slugRegex.test(c.slug)) {
            urls.issues.push({ severity: "warning", message: `Category slug not URL-friendly: "${c.slug}"`, entity: c.name });
          } else {
            urls.score++;
          }
          const existing = catSlugs.get(c.slug) || [];
          existing.push(c.name);
          catSlugs.set(c.slug, existing);
        }
      }
      for (const [slug, names] of catSlugs) {
        if (names.length > 1) {
          urls.issues.push({ severity: "error", message: `Duplicate category slug "${slug}" used by: ${names.join(", ")}` });
        }
      }
      urls.passed = urls.total - urls.issues.filter(i => i.severity === "error").length;

      const images: AuditCategory = { name: "Images", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };

      const imgResult = await pool.query(`
        SELECT p.id, p.name, p.image_url, COUNT(pi.id) as img_count
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.active = true
        GROUP BY p.id, p.name, p.image_url
      `);

      for (const row of imgResult.rows) {
        images.total++;
        images.maxScore += 3;
        let points = 0;

        if (!row.image_url || row.image_url.trim() === "") {
          images.issues.push({ severity: "error", message: `Missing primary image`, entity: row.name });
        } else {
          points++;
          const imgPath = path.resolve(import.meta.dirname, "..", "client", "public", row.image_url.replace(/^\//, ""));
          if (!fs.existsSync(imgPath)) {
            images.issues.push({ severity: "warning", message: `Primary image file not found: ${row.image_url}`, entity: row.name });
          } else {
            points++;
          }
        }

        if (parseInt(row.img_count) === 0) {
          images.issues.push({ severity: "info", message: `No additional gallery images`, entity: row.name });
        } else {
          points++;
        }
        images.score += points;
      }
      images.passed = images.total - images.issues.filter(i => i.severity === "error").length;

      const structuredData: AuditCategory = { name: "Structured Data", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };
      const categoryMap = new Map(categories.map(c => [c.id, c]));

      for (const p of activeProducts) {
        structuredData.total++;
        structuredData.maxScore += 5;
        let points = 0;

        if (p.name && p.name.trim()) points++;
        else structuredData.issues.push({ severity: "error", message: `Missing name (required for Product schema)`, entity: p.name || `ID: ${p.id}` });

        if (p.description && p.description.trim()) points++;
        else structuredData.issues.push({ severity: "warning", message: `Missing description for structured data`, entity: p.name });

        if (p.imageUrl && p.imageUrl.trim()) points++;
        else structuredData.issues.push({ severity: "error", message: `Missing image for structured data`, entity: p.name });

        if (p.price && p.price > 0) points++;
        else structuredData.issues.push({ severity: "error", message: `Missing or zero price`, entity: p.name });

        if (p.sku && p.sku.trim()) points++;
        else structuredData.issues.push({ severity: "warning", message: `Missing SKU`, entity: p.name });

        if (p.categoryId && !categoryMap.has(p.categoryId)) {
          structuredData.issues.push({ severity: "error", message: `References non-existent category (ID: ${p.categoryId})`, entity: p.name });
        }

        structuredData.score += points;
      }
      structuredData.passed = structuredData.total - structuredData.issues.filter(i => i.severity === "error").length;

      const content: AuditCategory = { name: "Content Quality", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };

      for (const p of activeProducts) {
        content.total++;
        content.maxScore += 3;
        let points = 0;

        if (p.description && p.description.length >= 100) {
          points++;
        } else if (p.description) {
          content.issues.push({ severity: "warning", message: `Short description (${p.description.length} chars, recommended 100+)`, entity: p.name });
        }

        if (p.bulletPoints && p.bulletPoints.trim()) {
          points++;
        } else {
          content.issues.push({ severity: "info", message: `No bullet points`, entity: p.name });
        }

        if (p.searchKeywords && p.searchKeywords.trim()) {
          points++;
        } else {
          content.issues.push({ severity: "info", message: `No search keywords`, entity: p.name });
        }

        content.score += points;
      }
      content.passed = content.total - content.issues.filter(i => i.severity === "error" || i.severity === "warning").length;

      const technical: AuditCategory = { name: "Technical SEO", score: 0, maxScore: 7, passed: 0, total: 7, issues: [] };

      const publicDir = path.resolve(import.meta.dirname, "..", "client", "public");

      const ogImageExists = fs.existsSync(path.resolve(publicDir, "og-image.png"));
      if (ogImageExists) { technical.score++; technical.passed++; }
      else technical.issues.push({ severity: "error", message: "OG image (og-image.png) not found in public/" });

      const manifestExists = fs.existsSync(path.resolve(publicDir, "manifest.json"));
      if (manifestExists) { technical.score++; technical.passed++; }
      else technical.issues.push({ severity: "warning", message: "manifest.json not found (PWA support)" });

      const faviconExists = fs.existsSync(path.resolve(publicDir, "favicon.png"));
      if (faviconExists) { technical.score++; technical.passed++; }
      else technical.issues.push({ severity: "warning", message: "favicon.png not found" });

      const sitemapActiveCount = activeProducts.length + categories.length + 7;
      technical.score++;
      technical.passed++;
      technical.issues.push({ severity: "info", message: `Sitemap covers ~${sitemapActiveCount} URLs (${activeProducts.length} products, ${categories.length} categories, 7 static pages)` });

      technical.score++;
      technical.passed++;

      if (inactiveProducts.length > 0) {
        technical.issues.push({ severity: "info", message: `${inactiveProducts.length} inactive product(s) excluded from sitemap` });
      }

      technical.score++;
      technical.passed++;

      const hasRobotsTxt = true;
      if (hasRobotsTxt) { technical.score++; technical.passed++; }

      const allCategories = [metaTags, urls, images, structuredData, content, technical];
      const totalScore = allCategories.reduce((s, c) => s + c.score, 0);
      const totalMaxScore = allCategories.reduce((s, c) => s + c.maxScore, 0);
      const overallScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

      const totalIssues = {
        errors: allCategories.reduce((s, c) => s + c.issues.filter(i => i.severity === "error").length, 0),
        warnings: allCategories.reduce((s, c) => s + c.issues.filter(i => i.severity === "warning").length, 0),
        info: allCategories.reduce((s, c) => s + c.issues.filter(i => i.severity === "info").length, 0),
      };

      res.json({
        overallScore,
        totalIssues,
        categories: allCategories.map(c => ({
          name: c.name,
          score: c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 100,
          passed: c.passed,
          total: c.total,
          issues: c.issues,
        })),
        summary: {
          activeProducts: activeProducts.length,
          inactiveProducts: inactiveProducts.length,
          totalCategories: categories.length,
          sitemapUrls: sitemapActiveCount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("SEO audit error:", err);
      res.status(500).json({ message: "Failed to run SEO audit" });
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

  app.get("/api/auth/google-client-id", (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    res.json({ clientId: clientId || null });
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
