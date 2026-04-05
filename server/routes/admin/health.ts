import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { storage } from "../../storage";
import { requireAdmin, requireAdminAny } from "../../adminAuth";
import { currentDir, upload } from "../helpers";
import { fileStorage } from "../../providers/fileStorage";
import { db } from "../../db";
import { siteConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedDatabase } from "../../seed";

const BRAND_SLOTS: Record<string, string> = {
  desktop: "logo-desktop.png",
  mobile: "logo-mobile.png",
  favicon: "logo-favicon.png",
  footer: "logo-footer.png",
};

function getPublicDir(): string {
  const isProduction = currentDir.endsWith("/dist") || currentDir.endsWith("\\dist");
  if (isProduction) {
    return path.resolve(currentDir, "public");
  }
  return path.resolve(process.cwd(), "client", "public");
}

function getBrandImagesDir(): string {
  return path.resolve(getPublicDir(), "images");
}

function generatePWAIcons(sourcePath: string, publicDir: string): void {
  const faviconPath = path.join(publicDir, "favicon.png");
  const icon192Path = path.join(publicDir, "icon-192.png");
  const icon512Path = path.join(publicDir, "icon-512.png");
  try {
    execSync(`convert "${sourcePath}" -resize 32x32! "${faviconPath}"`);
    execSync(`convert "${sourcePath}" -resize 192x192! "${icon192Path}"`);
    execSync(`convert "${sourcePath}" -resize 512x512! "${icon512Path}"`);
  } catch (convertErr) {
    console.warn("ImageMagick convert failed, writing raw copies:", convertErr);
    const buf = fs.readFileSync(sourcePath);
    fs.writeFileSync(faviconPath, buf);
    fs.writeFileSync(icon192Path, buf);
    fs.writeFileSync(icon512Path, buf);
  }
}

export async function restoreBrandLogosFromDB(): Promise<void> {
  try {
    const publicDir = getPublicDir();
    const imagesDir = getBrandImagesDir();

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    let hasFaviconSource = false;
    for (const [slot, filename] of Object.entries(BRAND_SLOTS)) {
      const config = await storage.getSiteConfig(`brand-logo-${slot}`);
      if (config) {
        const buf = Buffer.from(config.value, "base64");
        fs.writeFileSync(path.join(imagesDir, filename), buf);
        if (slot === "favicon") hasFaviconSource = true;
      }
    }

    const pwaKeys = ["brand-pwa-favicon", "brand-pwa-icon-192", "brand-pwa-icon-512"];
    const pwaFiles = ["favicon.png", "icon-192.png", "icon-512.png"];
    let restoredPWA = false;
    for (let i = 0; i < pwaKeys.length; i++) {
      const config = await storage.getSiteConfig(pwaKeys[i]);
      if (config) {
        fs.writeFileSync(path.join(publicDir, pwaFiles[i]), Buffer.from(config.value, "base64"));
        restoredPWA = true;
      }
    }

    if (!restoredPWA && hasFaviconSource) {
      generatePWAIcons(path.join(imagesDir, BRAND_SLOTS.favicon), publicDir);
    }

    console.log("Brand logos restored from database");
  } catch (err) {
    console.warn("Could not restore brand logos from DB (non-fatal):", err);
  }
}

export function registerAdminHealthRoutes(app: Express) {

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

  const SWATCHES_DIR = path.join(process.cwd(), "client", "public", "images", "swatches");
  if (!fs.existsSync(SWATCHES_DIR)) fs.mkdirSync(SWATCHES_DIR, { recursive: true });

  app.post("/api/upload-swatch", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    try {
      const crypto = await import("crypto");
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const filename = `${Date.now()}-${crypto.default.randomBytes(6).toString("hex")}${ext}`;
      await fs.promises.writeFile(path.join(SWATCHES_DIR, filename), req.file.buffer);
      res.json({ url: `/images/swatches/${filename}` });
    } catch (err) {
      console.error("Swatch upload error:", err);
      res.status(500).json({ message: "Failed to upload swatch" });
    }
  });

  app.get("/api/admin/brand-logos", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const imagesDir = getBrandImagesDir();
      const logos: Record<string, string | null> = {};
      for (const [slot, filename] of Object.entries(BRAND_SLOTS)) {
        const filePath = path.join(imagesDir, filename);
        logos[slot] = fs.existsSync(filePath) ? `/images/${filename}?t=${fs.statSync(filePath).mtimeMs}` : null;
      }
      res.json(logos);
    } catch (err) {
      console.error("Brand logos error:", err);
      res.status(500).json({ message: "Failed to fetch brand logos" });
    }
  });

  app.post("/api/admin/brand-logo", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    const slot = req.body?.slot as string;
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    if (!slot || !BRAND_SLOTS[slot]) {
      return res.status(400).json({ message: "Invalid slot. Must be one of: desktop, mobile, favicon, footer" });
    }

    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Only PNG, JPEG, and WebP are allowed." });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
    }

    try {
      const imagesDir = getBrandImagesDir();
      const publicDir = getPublicDir();
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      const targetPath = path.join(imagesDir, BRAND_SLOTS[slot]);
      fs.writeFileSync(targetPath, req.file.buffer);

      await storage.upsertSiteConfig(`brand-logo-${slot}`, req.file.buffer.toString("base64"));

      if (slot === "favicon") {
        generatePWAIcons(targetPath, publicDir);

        const faviconPath = path.join(publicDir, "favicon.png");
        const icon192Path = path.join(publicDir, "icon-192.png");
        const icon512Path = path.join(publicDir, "icon-512.png");
        if (fs.existsSync(faviconPath)) {
          await storage.upsertSiteConfig("brand-pwa-favicon", fs.readFileSync(faviconPath).toString("base64"));
        }
        if (fs.existsSync(icon192Path)) {
          await storage.upsertSiteConfig("brand-pwa-icon-192", fs.readFileSync(icon192Path).toString("base64"));
        }
        if (fs.existsSync(icon512Path)) {
          await storage.upsertSiteConfig("brand-pwa-icon-512", fs.readFileSync(icon512Path).toString("base64"));
        }
      }

      res.json({ url: `/images/${BRAND_SLOTS[slot]}?t=${Date.now()}` });
    } catch (err) {
      console.error("Brand logo upload error:", err);
      res.status(500).json({ message: "Failed to upload brand logo" });
    }
  });

  app.get("/api/admin/deploy-check", requireAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const projectRoot = path.resolve(currentDir, "..");
      const isProduction = currentDir.endsWith("/dist") || currentDir.endsWith("\\dist");
      const distDir = isProduction ? currentDir : path.resolve(projectRoot, "dist");
      const publicDir = path.resolve(distDir, "public");
      const serverBundle = path.resolve(distDir, "index.cjs");
      const srcDir = path.resolve(projectRoot, "server");
      const clientDir = path.resolve(projectRoot, "client");
      const sharedDir = path.resolve(projectRoot, "shared");

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

      const getNewestFileTime = (dir: string): { file: string; mtime: Date } | null => {
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

  app.get("/api/admin/data-check", requireAdmin, async (_req, res) => {
    try {
      const { pool } = await import("../../db");
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

      const isCuid2 = (val: string) => /^[a-z0-9]{24,}$/.test(val);

      const getColumnType = async (tableName: string, columnName: string): Promise<string> => {
        try {
          const r = await pool.query(
            `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            [tableName, columnName]
          );
          return r.rows[0]?.data_type || "unknown";
        } catch { return "unknown"; }
      };

      const idFormatTables = ["categories", "products", "product_images", "product_reviews", "tags"];
      const idFormatChecks: { table: string; column: string; actualType: string; expectedType: string; totalRows: number; cuid2Count: number; nonCuid2Count: number; sampleIds: string[]; status: "pass" | "fail" | "empty" }[] = [];

      for (const table of idFormatTables) {
        try {
          const actualType = await getColumnType(table, "id");
          const countResult = await pool.query(`SELECT COUNT(*)::int as cnt FROM "${table}"`);
          const total = countResult.rows[0].cnt;
          if (total === 0) {
            idFormatChecks.push({ table, column: "id", actualType, expectedType: "text", totalRows: 0, cuid2Count: 0, nonCuid2Count: 0, sampleIds: [], status: "empty" });
            continue;
          }
          const idsResult = await pool.query(`SELECT id FROM "${table}" LIMIT 100`);
          const allIds = idsResult.rows.map((r: any) => String(r.id));
          const cuid2Count = allIds.filter(isCuid2).length;
          const nonCuid2Count = allIds.length - cuid2Count;
          const fullNonCuid2 = total > 100 ? Math.round((nonCuid2Count / allIds.length) * total) : nonCuid2Count;
          const fullCuid2 = total - fullNonCuid2;

          const sampleResult = await pool.query(`SELECT id FROM "${table}" ORDER BY id LIMIT 3`);
          const sampleIds = sampleResult.rows.map((r: any) => String(r.id));

          idFormatChecks.push({
            table,
            column: "id",
            actualType,
            expectedType: "text",
            totalRows: total,
            cuid2Count: fullCuid2,
            nonCuid2Count: fullNonCuid2,
            sampleIds,
            status: fullNonCuid2 > 0 || actualType !== "text" ? "fail" : "pass",
          });

          if (table === "products") {
            try {
              const skuType = await getColumnType("products", "sku");
              const skuNulls = (await pool.query(`SELECT COUNT(*)::int as cnt FROM products WHERE sku IS NULL OR sku = ''`)).rows[0].cnt;
              const skuPopulated = total - skuNulls;
              const skuSample = await pool.query(`SELECT sku FROM products WHERE sku IS NOT NULL AND sku != '' ORDER BY sku LIMIT 3`);
              const skuSampleVals = skuSample.rows.map((r: any) => String(r.sku));
              idFormatChecks.push({
                table: "products",
                column: "sku",
                actualType: skuType,
                expectedType: "text",
                totalRows: total,
                cuid2Count: skuPopulated,
                nonCuid2Count: skuNulls,
                sampleIds: skuSampleVals,
                status: skuNulls > 0 || skuType !== "text" ? "fail" : "pass",
              });
            } catch { /* skip */ }
          }
        } catch {
          idFormatChecks.push({ table, column: "id", actualType: "unknown", expectedType: "text", totalRows: 0, cuid2Count: 0, nonCuid2Count: 0, sampleIds: [], status: "empty" });
        }
      }

      const fkIdChecks: { table: string; column: string; actualType: string; expectedType: string; totalRows: number; cuid2Count: number; nonCuid2Count: number; status: "pass" | "fail" | "empty" }[] = [];
      const fkColumns: { table: string; column: string }[] = [
        { table: "products", column: "category_id" },
        { table: "product_images", column: "product_id" },
        { table: "product_reviews", column: "product_id" },
      ];
      for (const fk of fkColumns) {
        try {
          const actualType = await getColumnType(fk.table, fk.column);
          const countResult = await pool.query(`SELECT COUNT(*)::int as cnt FROM "${fk.table}"`);
          const total = countResult.rows[0].cnt;
          if (total === 0) {
            fkIdChecks.push({ ...fk, actualType, expectedType: "text", totalRows: 0, cuid2Count: 0, nonCuid2Count: 0, status: "empty" });
            continue;
          }
          const vals = await pool.query(`SELECT "${fk.column}" as val FROM "${fk.table}" WHERE "${fk.column}" IS NOT NULL LIMIT 100`);
          const allVals = vals.rows.map((r: any) => String(r.val));
          const c2 = allVals.filter(isCuid2).length;
          const nc2 = allVals.length - c2;
          const fullNc2 = total > 100 ? Math.round((nc2 / allVals.length) * total) : nc2;
          fkIdChecks.push({ ...fk, actualType, expectedType: "text", totalRows: total, cuid2Count: total - fullNc2, nonCuid2Count: fullNc2, status: fullNc2 > 0 || actualType !== "text" ? "fail" : "pass" });
        } catch {
          fkIdChecks.push({ ...fk, actualType: "unknown", expectedType: "text", totalRows: 0, cuid2Count: 0, nonCuid2Count: 0, status: "empty" });
        }
      }

      const completenessFields = ["sku", "material", "color", "dimensions", "audience", "product_type"];
      const dataCompleteness: { field: string; actualType: string; expectedType: string; totalProducts: number; nullCount: number; populatedCount: number; status: "pass" | "warn" }[] = [];
      try {
        const totalProducts = (await pool.query(`SELECT COUNT(*)::int as cnt FROM products`)).rows[0].cnt;
        for (const field of completenessFields) {
          const actualType = await getColumnType("products", field);
          const nulls = (await pool.query(`SELECT COUNT(*)::int as cnt FROM products WHERE "${field}" IS NULL OR "${field}" = ''`)).rows[0].cnt;
          dataCompleteness.push({
            field,
            actualType,
            expectedType: "text",
            totalProducts,
            nullCount: nulls,
            populatedCount: totalProducts - nulls,
            status: nulls > 0 ? "warn" : "pass",
          });
        }
      } catch { /* table may not exist */ }

      const sampleData: { products: { id: string; slug: string; sku: string | null }[]; categories: { id: string; slug: string; name: string }[] } = { products: [], categories: [] };
      try {
        const sp = await pool.query(`SELECT id, slug, sku FROM products ORDER BY slug LIMIT 5`);
        sampleData.products = sp.rows.map((r: any) => ({ id: String(r.id), slug: r.slug, sku: r.sku }));
        const sc = await pool.query(`SELECT id, slug, name FROM categories ORDER BY slug LIMIT 5`);
        sampleData.categories = sc.rows.map((r: any) => ({ id: String(r.id), slug: r.slug, name: r.name }));
      } catch { /* ignore */ }

      const hasIdFormatIssues = idFormatChecks.some(c => c.status === "fail") || fkIdChecks.some(c => c.status === "fail");
      const hasCompletenessIssues = dataCompleteness.some(c => c.status === "warn");

      const overallStatus = structureChecks.some(c => c.status === "fail" || c.status === "missing_table") || hasIdFormatIssues
        ? "fail"
        : structureChecks.some(c => c.status === "warn") || tableCounts.some(c => c.status === "empty") || integrityIssues.length > 0 || hasCompletenessIssues
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
        idFormatChecks,
        fkIdChecks,
        dataCompleteness,
        sampleData,
      });
    } catch (err) {
      console.error("Data check error:", err);
      res.status(500).json({ message: "Failed to run data check" });
    }
  });

  app.get("/api/admin/seo-audit", requireAdmin, async (_req, res) => {
    try {
      const fs = await import("fs");
      const seoIsProduction = currentDir.endsWith("/dist") || currentDir.endsWith("\\dist");
      const seoPublicDir = seoIsProduction
        ? path.resolve(currentDir, "public")
        : path.resolve(currentDir, "..", "client", "public");
      const allProducts = await storage.getProducts();
      const categories = await storage.getCategories();
      const { pool } = await import("../../db");

      interface AuditIssue {
        severity: "error" | "warning" | "info";
        message: string;
        entity?: string;
        entitySku?: string;
      }

      interface AuditCategory {
        name: string;
        score: number;
        maxScore: number;
        passed: number;
        total: number;
        issues: AuditIssue[];
      }

      const activeProducts = allProducts.filter(p => p.active);
      const inactiveProducts = allProducts.filter(p => !p.active);

      const metaTags: AuditCategory = { name: "Meta Tags", score: 0, maxScore: 0, passed: 0, total: 0, issues: [] };

      for (const p of activeProducts) {
        metaTags.total++;
        metaTags.maxScore += 3;
        let points = 0;

        if (!p.description || p.description.trim().length === 0) {
          metaTags.issues.push({ severity: "error", message: `Missing description (used as meta description)`, entity: p.name, entitySku: p.sku });
        } else {
          points++;
          if (p.description.length < 50) {
            metaTags.issues.push({ severity: "warning", message: `Description too short (${p.description.length} chars, min 50)`, entity: p.name, entitySku: p.sku });
          } else {
            points++;
          }
          if (p.description.length > 300) {
            metaTags.issues.push({ severity: "info", message: `Description very long (${p.description.length} chars), may be truncated in search results`, entity: p.name, entitySku: p.sku });
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
          urls.issues.push({ severity: "error", message: `Missing slug`, entity: p.name, entitySku: p.sku });
        } else {
          if (!slugRegex.test(p.slug)) {
            urls.issues.push({ severity: "warning", message: `Slug not URL-friendly: "${p.slug}"`, entity: p.name, entitySku: p.sku });
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
        SELECT p.id, p.name, p.sku, p.image_url, COUNT(pi.id) as img_count
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.active = true
        GROUP BY p.id, p.name, p.sku, p.image_url
      `);

      for (const row of imgResult.rows) {
        images.total++;
        images.maxScore += 3;
        let points = 0;

        if (!row.image_url || row.image_url.trim() === "") {
          images.issues.push({ severity: "error", message: `Missing primary image`, entity: row.name, entitySku: row.sku });
        } else {
          points++;
          const imgPath = path.resolve(seoPublicDir, row.image_url.replace(/^\//, ""));
          if (!fs.existsSync(imgPath)) {
            images.issues.push({ severity: "warning", message: `Primary image file not found: ${row.image_url}`, entity: row.name, entitySku: row.sku });
          } else {
            points++;
          }
        }

        if (parseInt(row.img_count) === 0) {
          images.issues.push({ severity: "info", message: `No additional gallery images`, entity: row.name, entitySku: row.sku });
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
        else structuredData.issues.push({ severity: "error", message: `Missing name (required for Product schema)`, entity: p.name || 'Unnamed', entitySku: p.sku });

        if (p.description && p.description.trim()) points++;
        else structuredData.issues.push({ severity: "warning", message: `Missing description for structured data`, entity: p.name, entitySku: p.sku });

        if (p.imageUrl && p.imageUrl.trim()) points++;
        else structuredData.issues.push({ severity: "error", message: `Missing image for structured data`, entity: p.name, entitySku: p.sku });

        if (p.price && p.price > 0) points++;
        else structuredData.issues.push({ severity: "error", message: `Missing or zero price`, entity: p.name, entitySku: p.sku });

        if (p.sku && p.sku.trim()) points++;
        else structuredData.issues.push({ severity: "warning", message: `Missing SKU`, entity: p.name, entitySku: p.sku });

        if (p.categoryId && !categoryMap.has(p.categoryId)) {
          structuredData.issues.push({ severity: "error", message: `References non-existent category (ID: ${p.categoryId})`, entity: p.name, entitySku: p.sku });
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
          content.issues.push({ severity: "warning", message: `Short description (${p.description.length} chars, recommended 100+)`, entity: p.name, entitySku: p.sku });
        }

        if (p.bulletPoints && p.bulletPoints.trim()) {
          points++;
        } else {
          content.issues.push({ severity: "info", message: `No bullet points`, entity: p.name, entitySku: p.sku });
        }

        if (p.searchKeywords && p.searchKeywords.trim()) {
          points++;
        } else {
          content.issues.push({ severity: "info", message: `No search keywords`, entity: p.name, entitySku: p.sku });
        }

        content.score += points;
      }
      content.passed = content.total - content.issues.filter(i => i.severity === "error" || i.severity === "warning").length;

      const technical: AuditCategory = { name: "Technical SEO", score: 0, maxScore: 7, passed: 0, total: 7, issues: [] };

      const ogImageExists = fs.existsSync(path.resolve(seoPublicDir, "og-image.png"));
      if (ogImageExists) { technical.score++; technical.passed++; }
      else technical.issues.push({ severity: "error", message: "OG image (og-image.png) not found in public/" });

      const manifestExists = fs.existsSync(path.resolve(seoPublicDir, "manifest.json"));
      if (manifestExists) { technical.score++; technical.passed++; }
      else technical.issues.push({ severity: "warning", message: "manifest.json not found (PWA support)" });

      const faviconExists = fs.existsSync(path.resolve(seoPublicDir, "favicon.png"));
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
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="turtlelittle_backup_${timestamp}.txt"`);
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

  // ── DB Snapshot (catalog tables only) ────────────────────────────────────
  app.get("/api/admin/db-snapshot", requireAdminAny, async (_req, res) => {
    try {
      const { pool } = await import("../../db");
      const [cats, prods, tgs, ptags, imgs, revs] = await Promise.all([
        pool.query(`SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order`),
        pool.query(`SELECT id, sku, name, slug, price, mrp, active, category_id FROM products ORDER BY sort_order`),
        pool.query(`SELECT id, name FROM tags ORDER BY name`),
        pool.query(`
          SELECT pt.product_id, p.slug AS product_slug, pt.tag_id, t.name AS tag_name
          FROM product_tags pt
          LEFT JOIN products p ON pt.product_id = p.id
          LEFT JOIN tags t ON pt.tag_id = t.id
          ORDER BY p.slug, t.name`),
        pool.query(`SELECT id, product_id FROM product_images ORDER BY id`),
        pool.query(`SELECT id, product_id FROM product_reviews ORDER BY id`),
      ]);
      res.json({
        categories:     cats.rows,
        products:       prods.rows,
        tags:           tgs.rows,
        productTags:    ptags.rows,
        productImages:  imgs.rows,
        productReviews: revs.rows,
      });
    } catch (err: any) {
      console.error("db-snapshot error:", err.message);
      res.status(500).json({ message: "Failed to generate snapshot" });
    }
  });

  // ── DB Compare (dev calls prod snapshot and diffs) ────────────────────────
  app.post("/api/admin/db-compare", requireAdmin, async (req, res) => {
    try {
      const { prodUrl } = req.body as { prodUrl: string };
      if (!prodUrl) return res.status(400).json({ message: "prodUrl is required" });

      const adminPassword = process.env.ADMIN_PASSWORD || "";
      const [localSnap, prodResp] = await Promise.all([
        (async () => {
          const { pool } = await import("../../db");
          const [cats, prods, tgs, ptags, imgs, revs] = await Promise.all([
            pool.query(`SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order`),
            pool.query(`SELECT id, sku, name, slug, price, mrp, active, category_id FROM products ORDER BY sort_order`),
            pool.query(`SELECT id, name FROM tags ORDER BY name`),
            pool.query(`
              SELECT pt.product_id, p.slug AS product_slug, pt.tag_id, t.name AS tag_name
              FROM product_tags pt
              LEFT JOIN products p ON pt.product_id = p.id
              LEFT JOIN tags t ON pt.tag_id = t.id
              ORDER BY p.slug, t.name`),
            pool.query(`SELECT id, product_id FROM product_images ORDER BY id`),
            pool.query(`SELECT id, product_id FROM product_reviews ORDER BY id`),
          ]);
          return { categories: cats.rows, products: prods.rows, tags: tgs.rows, productTags: ptags.rows, productImages: imgs.rows, productReviews: revs.rows };
        })(),
        fetch(`${prodUrl.replace(/\/$/, "")}/api/admin/db-snapshot`, {
          headers: { "x-admin-password": adminPassword },
        }),
      ]);

      if (!prodResp.ok) {
        const text = await prodResp.text();
        return res.status(502).json({ message: `Prod snapshot failed (${prodResp.status}): ${text.slice(0, 200)}` });
      }
      const prodSnap = await prodResp.json() as typeof localSnap;

      // ID-based diff for tables where ID is the canonical identity
      function diffById<T extends { id: string }>(devRows: T[], prodRows: T[], fields: (keyof T)[]) {
        const devMap = new Map(devRows.map(r => [r.id, r]));
        const prodMap = new Map(prodRows.map(r => [r.id, r]));
        const onlyInDev = devRows.filter(r => !prodMap.has(r.id)).map(r => r.id);
        const onlyInProd = prodRows.filter(r => !devMap.has(r.id)).map(r => r.id);
        const fieldMismatches: { id: string; field: string; dev: unknown; prod: unknown }[] = [];
        for (const [id, devRow] of devMap) {
          const prodRow = prodMap.get(id);
          if (!prodRow) continue;
          for (const f of fields) {
            const dv = String(devRow[f] ?? "");
            const pv = String((prodRow as any)[f] ?? "");
            if (dv !== pv) fieldMismatches.push({ id, field: String(f), dev: devRow[f], prod: (prodRow as any)[f] });
          }
        }
        return { devCount: devRows.length, prodCount: prodRows.length, onlyInDev, onlyInProd, fieldMismatches };
      }

      // Content-based diff for junction/dependent tables where row ID is irrelevant
      function diffByContent(devRows: any[], prodRows: any[], keyFn: (r: any) => string, labelFn: (r: any) => string) {
        const devKeys  = new Map(devRows.map(r  => [keyFn(r),  labelFn(r)]));
        const prodKeys = new Map(prodRows.map(r => [keyFn(r), labelFn(r)]));
        const onlyInDev  = devRows.filter(r  => !prodKeys.has(keyFn(r))).map(r  => labelFn(r));
        const onlyInProd = prodRows.filter(r => !devKeys.has(keyFn(r))).map(r => labelFn(r));
        return { devCount: devRows.length, prodCount: prodRows.length, onlyInDev, onlyInProd };
      }

      const devProds  = localSnap.products  as any[];
      const prodProds = prodSnap.products   as any[];
      const devSkuMap  = new Map(devProds.map(p  => [p.sku,  p]));
      const prodSkuMap = new Map(prodProds.map(p => [p.sku, p]));
      const onlySkuInDev  = devProds.filter(p  => !prodSkuMap.has(p.sku)).map(p  => p.sku);
      const onlySkuInProd = prodProds.filter(p => !devSkuMap.has(p.sku)).map(p => p.sku);
      const skuNameMismatches: { sku: string; devName: string; prodName: string }[] = [];
      for (const [sku, dp] of devSkuMap) {
        const pp = prodSkuMap.get(sku);
        if (pp && dp.name !== pp.name) skuNameMismatches.push({ sku, devName: dp.name, prodName: pp.name });
      }

      res.json({
        checkedAt: new Date().toISOString(),
        prodUrl,
        categories:     diffById(localSnap.categories as any[], prodSnap.categories as any[], ["name", "slug", "sort_order"]),
        products:       { ...diffById(devProds, prodProds, ["sku", "name", "slug", "price", "mrp", "active", "category_id"]), onlySkuInDev, onlySkuInProd, skuNameMismatches },
        tags:           diffById(localSnap.tags as any[], prodSnap.tags as any[], ["name"]),
        productTags:    diffByContent(
                          localSnap.productTags  as any[], prodSnap.productTags  as any[],
                          r => `${r.product_id}|${r.tag_id}`,
                          r => `${r.product_slug || r.product_id} → ${r.tag_name || r.tag_id}`),
        productImages:  diffById(localSnap.productImages  as any[], prodSnap.productImages  as any[], ["product_id"]),
        productReviews: diffById(localSnap.productReviews as any[], prodSnap.productReviews as any[], ["product_id"]),
      });
    } catch (err: any) {
      console.error("db-compare error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

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

  // ── Force re-seed catalog tables ─────────────────────────────────────────
  // If prodUrl is provided, proxies to prod's version of this endpoint.
  // Otherwise, clears catalog hashes and runs seedDatabase() locally.
  app.post("/api/admin/catalog/force-reseed", requireAdminAny, async (req, res) => {
    try {
      const { prodUrl } = (req.body || {}) as { prodUrl?: string };

      if (prodUrl) {
        // Proxy mode: call prod's endpoint
        const adminPassword = process.env.ADMIN_PASSWORD || "";
        const prodResp = await fetch(`${prodUrl.replace(/\/$/, "")}/api/admin/catalog/force-reseed`, {
          method: "POST",
          headers: {
            "x-admin-password": adminPassword,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const rawText = await prodResp.text();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { message: `Prod returned non-JSON (${prodResp.status}): ${rawText.slice(0, 300)}` };
        }
        if (!prodResp.ok) return res.status(502).json(data);
        return res.json(data);
      }

      // Local mode: clear catalog hashes so seedDatabase() re-runs all tables
      const catalogTables = ["categories", "tags", "products", "productImages", "productReviews", "productTags"];
      for (const table of catalogTables) {
        await db.delete(siteConfig).where(eq(siteConfig.key, `seed-hash-${table}`));
      }
      console.log("[force-reseed] Cleared catalog hashes, running seed...");

      await seedDatabase();

      // Query final counts for the response summary
      const { pool } = await import("../../db");
      const [cats, prods, tgs, ptags, imgs, revs] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM categories`),
        pool.query(`SELECT COUNT(*) FROM products`),
        pool.query(`SELECT COUNT(*) FROM tags`),
        pool.query(`SELECT COUNT(*) FROM product_tags`),
        pool.query(`SELECT COUNT(*) FROM product_images`),
        pool.query(`SELECT COUNT(*) FROM product_reviews`),
      ]);

      res.json({
        success: true,
        message: "Catalog re-seeded successfully",
        counts: {
          categories:     Number(cats.rows[0].count),
          products:       Number(prods.rows[0].count),
          tags:           Number(tgs.rows[0].count),
          productTags:    Number(ptags.rows[0].count),
          productImages:  Number(imgs.rows[0].count),
          productReviews: Number(revs.rows[0].count),
        },
      });
    } catch (err: any) {
      console.error("force-reseed error:", err.message);
      res.status(500).json({ message: err.message || "Force re-seed failed" });
    }
  });

  // ── Export current DB catalog → seed-data.json ────────────────────────────
  app.post("/api/admin/export/seed", requireAdmin, async (_req, res) => {
    try {
      const { pool } = await import("../../db");
      const seedPath = path.resolve(process.cwd(), "server", "seed-data.json");

      // Read the existing seed-data.json to preserve non-catalog sections
      const existing = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

      // Export categories
      const catsResult = await pool.query(
        `SELECT id, name, slug, description, image_url AS "imageUrl", sort_order AS "sortOrder"
         FROM categories ORDER BY sort_order`
      );

      // Export tags
      const tagsResult = await pool.query(
        `SELECT id, name, description FROM tags ORDER BY name`
      );

      // Export products (with categorySlug via JOIN)
      const prodsResult = await pool.query(
        `SELECT p.id, p.sku, p.name, p.slug, p.description,
                p.price, p.mrp, p.image_url AS "imageUrl",
                c.slug AS "categorySlug",
                p.amazon_asin AS "amazonAsin",
                p.color, p.material, p.gsm, p.dimensions,
                p.weight_grams AS "weightGrams",
                p.items_in_set AS "itemsInSet",
                p.special_features AS "specialFeatures",
                p.bullet_points AS "bulletPoints",
                p.search_keywords AS "searchKeywords",
                p.product_type AS "productType",
                p.audience, p.active, p.sort_order AS "sortOrder"
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.sort_order, p.id`
      );

      // Export product_images — all images stored in /images/products/ (includes uploads)
      const imgsResult = await pool.query(
        `SELECT pi.id, p.slug AS "productSlug", pi.image_url AS "imageUrl",
                pi.sort_order AS "sortOrder", pi.is_primary AS "isPrimary"
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
         WHERE pi.image_url LIKE '/images/products/%'
         ORDER BY p.slug, pi.sort_order`
      );

      // Export product_tags (with productSlug + tagName via JOINs)
      const ptagsResult = await pool.query(
        `SELECT pt.id, p.slug AS "productSlug", t.name AS "tagName"
         FROM product_tags pt
         JOIN products p ON p.id = pt.product_id
         JOIN tags t ON t.id = pt.tag_id
         ORDER BY p.slug, t.name`
      );

      // Export variantColors with swatch URLs in /images/swatches/
      const vcResult = await pool.query(
        `SELECT vc.id, vc.size_id AS "sizeId", vc.name,
                vc.swatch_url AS "swatchUrl",
                vc.blur_on_front AS "blurOnFront",
                vc.sort_order AS "sortOrder"
         FROM variant_colors vc
         ORDER BY vc.sort_order, vc.id`
      );

      const updated = {
        ...existing,
        categories:    catsResult.rows,
        tags:          tagsResult.rows,
        products:      prodsResult.rows,
        productImages: imgsResult.rows,
        productTags:   ptagsResult.rows,
        variantColors: vcResult.rows,
      };

      fs.writeFileSync(seedPath, JSON.stringify(updated, null, 2));

      res.json({
        success: true,
        exported: {
          categories:    catsResult.rowCount,
          tags:          tagsResult.rowCount,
          products:      prodsResult.rowCount,
          productImages: imgsResult.rowCount,
          productTags:   ptagsResult.rowCount,
          variantColors: vcResult.rowCount,
        },
        message: "seed-data.json updated successfully. Changes will take effect on next deployment.",
      });
    } catch (err: any) {
      console.error("export-seed error:", err.message);
      res.status(500).json({ message: err.message || "Failed to export seed" });
    }
  });
}
