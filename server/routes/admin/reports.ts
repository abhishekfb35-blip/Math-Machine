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

  app.get("/api/admin/reports/traffic", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const periodParam = req.query.period as string | undefined;
      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;

      let from: Date;
      let to: Date = now;

      if (fromParam && toParam) {
        from = new Date(fromParam + "T00:00:00.000Z");
        to = new Date(toParam + "T23:59:59.999Z");
      } else if (periodParam === "weekly") {
        from = new Date(now);
        from.setDate(from.getDate() - 7);
      } else {
        from = new Date(now);
        from.setDate(from.getDate() - 1);
      }

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ message: "Invalid date range" });
        return;
      }

      const report = await storage.getTrafficReport(from, to);
      res.json(report);
    } catch (err) {
      console.error("Traffic report error:", err);
      res.status(500).json({ message: "Failed to generate traffic report" });
    }
  });
}
