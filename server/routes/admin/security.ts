import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "../../adminAuth";
import { getRateLimitConfig, saveRateLimitConfig, loadRateLimitConfig, type RateLimitConfig } from "../../middleware/rateLimiter";
import { storage } from "../../storage";

const tierSchema = z.object({
  enabled: z.boolean(),
  windowMs: z.number().int().positive(),
  max: z.number().int().positive(),
});

const rateLimitConfigSchema = z.object({
  global:   tierSchema,
  moderate: tierSchema,
  strict:   tierSchema,
});

const guestCartCleanupSchema = z.object({
  enabled: z.boolean(),
  retentionDays: z.number().int().min(1).max(365),
});

export function registerAdminSecurityRoutes(app: Express) {
  app.get("/api/admin/security-config", requireAdmin, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const rateLimitConfig = getRateLimitConfig();

      let guestCartRetentionDays = 30;
      let guestCartCleanupEnabled = true;
      try {
        const record = await storage.getSiteConfig("guest-cart-cleanup");
        if (record) {
          const parsed = JSON.parse(record.value);
          guestCartRetentionDays = parsed.retentionDays ?? 30;
          guestCartCleanupEnabled = parsed.enabled ?? true;
        }
      } catch {}

      res.json({
        rateLimitConfig,
        guestCartCleanup: {
          enabled: guestCartCleanupEnabled,
          retentionDays: guestCartRetentionDays,
        },
      });
    } catch (err) {
      console.error("Get security config error:", err);
      res.status(500).json({ message: "Failed to fetch security config" });
    }
  });

  app.post("/api/admin/security-config", requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { rateLimitConfig, guestCartCleanup } = req.body;

      if (rateLimitConfig !== undefined) {
        const parsed = rateLimitConfigSchema.safeParse(rateLimitConfig);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid rate limit config", errors: parsed.error.errors });
        }
        await saveRateLimitConfig(parsed.data as RateLimitConfig);
      }

      if (guestCartCleanup !== undefined) {
        const parsed = guestCartCleanupSchema.safeParse(guestCartCleanup);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid cleanup config", errors: parsed.error.errors });
        }
        await storage.upsertSiteConfig(
          "guest-cart-cleanup",
          JSON.stringify(parsed.data)
        );
      }

      await loadRateLimitConfig();

      res.json({ success: true });
    } catch (err) {
      console.error("Save security config error:", err);
      res.status(500).json({ message: "Failed to save security config" });
    }
  });

  app.post("/api/admin/security/run-cart-cleanup", requireAdmin, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      let retentionDays = 30;
      try {
        const record = await storage.getSiteConfig("guest-cart-cleanup");
        if (record) {
          const parsed = JSON.parse(record.value);
          retentionDays = parsed.retentionDays ?? 30;
        }
      } catch {}

      const deleted = await storage.pruneGuestCarts(retentionDays);
      res.json({ success: true, deleted });
    } catch (err) {
      console.error("Cart cleanup error:", err);
      res.status(500).json({ message: "Failed to run cart cleanup" });
    }
  });
}
