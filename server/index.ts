import express, { type Request, Response, NextFunction } from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { seedDatabase } from "./seed";
import { ensurePolicyPages } from "./migrations/policy-pages";
import { ensureSkuNotNull } from "./migrations/sku-not-null";
import { syncImageReviewIds } from "./migrations/sync-image-review-ids";
import { migrateSiteConfigKeyPk } from "./migrations/site-config-key-pk";
import { ensureVariantTables } from "./migrations/variant-tables";
import { ensureVariantSizeFontColumn } from "./migrations/variant-size-font";
import { ensureCurrencyTables } from "./migrations/currency-tables";
import { ensureProductVariantColumns } from "./migrations/product-variant-options";
import { ensureShippingFeeColumn } from "./migrations/add-shipping-fee";
import { ensureCartCustomerColumns } from "./migrations/add-cart-customer";
import { ensureReviewCustomerColumn } from "./migrations/add-review-customer";
import { initializeExchangeRateService } from "./services/exchangeRateService";
import { restoreBrandLogosFromDB } from "./routes/admin/health";
import { nullifySwatchUploads } from "./migrations/nullify-swatch-uploads";
import { ensureAdminUsersTable } from "./migrations/admin-users-table";
import { ensureWishlistsTable } from "./migrations/wishlists-table";
import { ensureRateLimitStatsTable } from "./migrations/rate-limit-stats-table";
import { consolidateProductImages } from "./migrations/consolidate-product-images";
import { storage } from "./storage";
import { notificationService } from "./providers/notification";
import { createServer } from "http";
import { setupOgMiddleware } from "./ogMiddleware";
import { loadRateLimitConfig, getPendingBlockSnapshot, clearPendingBlocks } from "./middleware/rateLimiter";
import { recordCleanupRun } from "./services/cleanupHistory";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

function startGuestCartCleanupScheduler() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  const run = async () => {
    try {
      let retentionDays = 30;
      let enabled = true;
      try {
        const record = await storage.getSiteConfig("guest-cart-cleanup");
        if (record) {
          const parsed = JSON.parse(record.value);
          retentionDays = parsed.retentionDays ?? 30;
          enabled = parsed.enabled ?? true;
        }
      } catch {}

      try { await storage.pruneRateLimitStats(30); } catch {}

      if (!enabled) return;

      const deleted = await storage.pruneGuestCarts(retentionDays);
      await recordCleanupRun(deleted);
      if (deleted > 0) {
        log(`[guest-cart-cleanup] Pruned ${deleted} guest carts older than ${retentionDays} days`);
      }
    } catch (err: any) {
      console.error("[guest-cart-cleanup] Scheduler error:", err.message);
    }
  };

  setInterval(run, INTERVAL_MS);
  log("[guest-cart-cleanup] Scheduler started — runs daily");
}

let lastSecurityAlertAt = 0;

function startRateLimitStatsScheduler() {
  const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

  const flush = async () => {
    try {
      const snapshot = getPendingBlockSnapshot();
      if (snapshot.length === 0) return;
      clearPendingBlocks();

      const now = new Date();
      const bucketHour = new Date(now);
      bucketHour.setMinutes(0, 0, 0);

      for (const { tier, cat, count } of snapshot) {
        try {
          await storage.upsertRateLimitStats(tier, cat, bucketHour, count);
        } catch (e: any) {
          console.error("[rate-limit-stats] flush error:", e.message);
        }
      }

      const totalBlocks = snapshot.reduce((s, x) => s + x.count, 0);
      log(`[rate-limit-stats] Flushed ${totalBlocks} blocks to DB`);

      try {
        const alertRecord = await storage.getSiteConfig("security-alert-config");
        if (alertRecord) {
          const alertCfg = JSON.parse(alertRecord.value);
          const alertEmail: string = alertCfg.alertEmail || "";
          const threshold: number = alertCfg.alertThreshold ?? 50;
          const cooldownMs: number = (alertCfg.alertCooldownMinutes ?? 60) * 60 * 1000;

          if (alertEmail && totalBlocks >= threshold) {
            const now = Date.now();
            if (now - lastSecurityAlertAt > cooldownMs) {
              lastSecurityAlertAt = now;
              notificationService.sendSecurityAlert({
                toEmail: alertEmail,
                totalBlocks,
                windowMinutes: 5,
                breakdown: snapshot,
                siteUrl: "turtlelittle.com",
              }).then(r => {
                if (r.success) log(`[rate-limit-stats] Security alert sent to ${alertEmail}`);
                else console.error("[rate-limit-stats] Alert send failed:", r.error);
              }).catch(e => console.error("[rate-limit-stats] Alert error:", e.message));
            }
          }
        }
      } catch (e: any) {
        console.error("[rate-limit-stats] alert config load error:", e.message);
      }
    } catch (err: any) {
      console.error("[rate-limit-stats] Scheduler error:", err.message);
    }
  };

  setInterval(flush, FLUSH_INTERVAL_MS);
  log("[rate-limit-stats] Stats flush scheduler started — runs every 5 minutes");
}

function startAbandonedCartScheduler() {
  const INTERVAL_MS = 15 * 60 * 1000;

  const run = async () => {
    try {
      const abandonedCarts = await storage.getAbandonedCarts();
      for (const cart of abandonedCarts) {
        try {
          const cartItems = await storage.getCartItems(cart.cartId);
          if (cartItems.length === 0) continue;

          const itemDetails = await Promise.all(
            cartItems.map(async ci => {
              const product = await storage.getProductById(ci.productId);
              let effectivePrice = product?.price ?? 0;
              if (product && ci.selectedSize) {
                try {
                  const variantOptions = await storage.getProductVariantOptions(ci.productId);
                  const sizeConfig = variantOptions.sizes.find(s => s.name === ci.selectedSize);
                  if (sizeConfig && sizeConfig.priceAdd > 0) {
                    effectivePrice = product.price + sizeConfig.priceAdd;
                  }
                } catch {}
              }
              return {
                productName: product?.name ?? "Unknown Product",
                personalizationName: ci.personalizationName ?? null,
                quantity: ci.quantity,
                price: effectivePrice,
              };
            })
          );

          const firstName = (cart.customerName || "").split(" ")[0] || "";
          const cartUrl = "https://turtlelittle.com/cart";
          const result = await notificationService.sendAbandonedCart(cart.customerEmail, firstName, itemDetails, cartUrl);
          if (result.success) {
            await storage.markCartAbandonedEmailSent(cart.cartId);
            log(`[abandoned-cart] Sent email to ${cart.customerEmail} for cart ${cart.cartId}`);
          } else {
            console.error(`[abandoned-cart] Email delivery failed for cart ${cart.cartId}: ${result.error}`);
          }
        } catch (err: any) {
          console.error(`[abandoned-cart] Failed for cart ${cart.cartId}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[abandoned-cart] Scheduler error:", err.message);
    }
  };

  setInterval(run, INTERVAL_MS);
  log("[abandoned-cart] Scheduler started — checks every 15 minutes");
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  setupOgMiddleware(app, storage);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      (async () => {
        try {
          await migrateSiteConfigKeyPk();
          await ensureVariantTables();
          await ensureVariantSizeFontColumn();
          await ensureCurrencyTables();
          await ensureProductVariantColumns();
          await ensureShippingFeeColumn();
          await ensureCartCustomerColumns();
          await ensureReviewCustomerColumn();
          await seedDatabase();
          await initializeExchangeRateService();
          await ensureSkuNotNull();
          await syncImageReviewIds();
          await ensurePolicyPages();
          await restoreBrandLogosFromDB();
          await nullifySwatchUploads();
          await ensureAdminUsersTable();
          await ensureWishlistsTable();
          await ensureRateLimitStatsTable();
          await consolidateProductImages();
          await loadRateLimitConfig();
          log("startup tasks complete");
          startAbandonedCartScheduler();
          startGuestCartCleanupScheduler();
          startRateLimitStatsScheduler();
        } catch (err: any) {
          console.error("Startup task failed:", err.message);
        }
      })();
    },
  );
})();
