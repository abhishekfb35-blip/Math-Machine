import type { Express, Request, Response } from "express";
import { requireAdmin } from "../../adminAuth";
import { storage } from "../../storage";

export function registerAdminConsentRoutes(app: Express) {
  app.get("/api/admin/consents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;

      const [consents, total] = await Promise.all([
        storage.getCustomerConsents({ limit, offset }),
        storage.getCustomerConsentsCount(),
      ]);

      res.json({ consents, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      console.error("Admin consents error:", err);
      res.status(500).json({ message: "Failed to fetch consents" });
    }
  });
}
