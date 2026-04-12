import type { Express, Request, Response } from "express";
import { requireAdmin, requireSuperAdmin } from "../../adminAuth";
import { getRateLimitConfig, saveRateLimitConfig, loadRateLimitConfig, type RateLimitConfig } from "../../middleware/rateLimiter";
import { storage } from "../../storage";

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

      if (rateLimitConfig) {
        const config = rateLimitConfig as RateLimitConfig;
        await saveRateLimitConfig(config);
      }

      if (guestCartCleanup) {
        await storage.upsertSiteConfig(
          "guest-cart-cleanup",
          JSON.stringify({
            enabled: guestCartCleanup.enabled ?? true,
            retentionDays: guestCartCleanup.retentionDays ?? 30,
          })
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
