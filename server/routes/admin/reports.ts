import type { Express, Request, Response } from "express";
import { requirePermission } from "../../adminAuth";
import { storage } from "../../storage";

export function registerAdminReportRoutes(app: Express) {
  app.get("/api/admin/reports/funnel", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const defaultFrom = new Date(now);
      defaultFrom.setDate(defaultFrom.getDate() - 30);

      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;

      const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : defaultFrom;
      const to = toParam ? new Date(toParam + "T23:59:59.999Z") : now;

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ message: "Invalid date range" });
        return;
      }

      const report = await storage.getFunnelReport(from, to);
      res.json(report);
    } catch (err) {
      console.error("Funnel report error:", err);
      res.status(500).json({ message: "Failed to generate funnel report" });
    }
  });
}
