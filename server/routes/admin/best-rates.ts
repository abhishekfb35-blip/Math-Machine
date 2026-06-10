import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { requirePermission } from "../../adminAuth";
import { z } from "zod";

const upsertRowSchema = z.object({
  categoryId: z.string().min(1),
  audienceId: z.string().min(1),
  wholesalePrice: z.number().int().min(0),
});

export function registerAdminBestRatesRoutes(app: Express) {
  app.get(
    "/api/admin/category-pricing",
    requirePermission("offers"),
    async (_req: Request, res: Response) => {
      try {
        const [pricing, counts] = await Promise.all([
          storage.getCategoryAudiencePricingAll(),
          storage.getProductCountByCategoryAndAudience(),
        ]);
        res.json({ pricing, counts });
      } catch {
        res.status(500).json({ message: "Failed to load category pricing" });
      }
    },
  );

  app.put(
    "/api/admin/category-pricing",
    requirePermission("offers"),
    async (req: Request, res: Response) => {
      try {
        const rows = z.array(upsertRowSchema).parse(req.body);
        const saved = await Promise.all(
          rows.map(r => storage.upsertCategoryAudiencePrice(r.categoryId, r.audienceId, r.wholesalePrice)),
        );
        res.json(saved);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
        res.status(500).json({ message: "Failed to save pricing" });
      }
    },
  );

  app.delete(
    "/api/admin/category-pricing/:categoryId/:audienceId",
    requirePermission("offers"),
    async (req: Request, res: Response) => {
      try {
        await storage.deleteCategoryAudiencePrice(req.params.categoryId, req.params.audienceId);
        res.json({ ok: true });
      } catch {
        res.status(500).json({ message: "Failed to delete pricing" });
      }
    },
  );
}
