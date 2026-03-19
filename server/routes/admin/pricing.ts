import type { Express } from "express";
import { storage } from "../../storage";
import { requireAdmin } from "../../adminAuth";
import { getCurrencyForIp } from "../../services/geoService";
import { fetchAndStoreRates, getRateServiceStatus } from "../../services/exchangeRateService";

export function registerAdminPricingRoutes(app: Express) {

  app.get("/api/geo", async (req, res) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) || req.socket.remoteAddress || "127.0.0.1";
    const currency = await getCurrencyForIp(ip);
    res.json({ currency, ip });
  });

  app.get("/api/currency/config", async (_req, res) => {
    try {
      const [rules, rates] = await Promise.all([
        storage.getPricingRules(),
        storage.getCurrencyRates(),
      ]);
      const rateMap: Record<string, number> = {};
      for (const r of rates) rateMap[r.currency] = r.rateFromInr;
      const enabledRules = rules.filter(r => r.enabled);
      res.json({
        currencies: enabledRules.map(r => ({
          code: r.currency,
          symbol: r.symbol,
          displayName: r.displayName,
          rate: rateMap[r.currency] ?? null,
          markupPercent: r.markupPercent,
          roundingRule: r.roundingRule,
        })),
      });
    } catch (err) {
      res.json({ currencies: [] });
    }
  });

  app.get("/api/admin/pricing-rules", requireAdmin, async (_req, res) => {
    try {
      const [rules, rates] = await Promise.all([
        storage.getPricingRules(),
        storage.getCurrencyRates(),
      ]);
      const rateMap: Record<string, { rate: number; updatedAt: Date }> = {};
      for (const r of rates) rateMap[r.currency] = { rate: r.rateFromInr, updatedAt: r.updatedAt };
      const status = getRateServiceStatus();
      res.json({
        rules: rules.map(r => ({
          ...r,
          rate: rateMap[r.currency]?.rate ?? null,
          rateUpdatedAt: rateMap[r.currency]?.updatedAt ?? null,
        })),
        status,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pricing rules" });
    }
  });

  app.put("/api/admin/pricing-rules/:currency", requireAdmin, async (req, res) => {
    try {
      const { currency } = req.params;
      const { markupPercent, roundingRule, enabled, symbol, displayName } = req.body;
      const updated = await storage.updatePricingRule(currency, {
        ...(markupPercent !== undefined && { markupPercent: parseFloat(markupPercent) }),
        ...(roundingRule !== undefined && { roundingRule }),
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        ...(symbol !== undefined && { symbol }),
        ...(displayName !== undefined && { displayName }),
      });
      if (!updated) return res.status(404).json({ message: "Currency not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update pricing rule" });
    }
  });

  app.post("/api/admin/pricing-rules/refresh-rates", requireAdmin, async (_req, res) => {
    try {
      await fetchAndStoreRates();
      const [rules, rates] = await Promise.all([
        storage.getPricingRules(),
        storage.getCurrencyRates(),
      ]);
      const rateMap: Record<string, { rate: number; updatedAt: Date }> = {};
      for (const r of rates) rateMap[r.currency] = { rate: r.rateFromInr, updatedAt: r.updatedAt };
      const status = getRateServiceStatus();
      res.json({
        rules: rules.map(r => ({
          ...r,
          rate: rateMap[r.currency]?.rate ?? null,
          rateUpdatedAt: rateMap[r.currency]?.updatedAt ?? null,
        })),
        status,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to refresh rates" });
    }
  });
}
