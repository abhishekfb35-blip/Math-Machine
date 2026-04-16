import type { Express } from "express";
import { storage } from "../../storage";
import { requirePermission } from "../../adminAuth";
import { detectCurrency } from "../../services/geoService";
import { fetchAndStoreRates, getRateServiceStatus } from "../../services/exchangeRateService";

export function registerAdminPricingRoutes(app: Express) {

  app.get("/api/geo", async (req, res) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) || req.ip || "127.0.0.1";
    try {
      const rules = await storage.getPricingRules();
      const enabledCurrencies = new Set(rules.filter(r => r.enabled).map(r => r.currency));
      const { country, currency } = await detectCurrency(ip, enabledCurrencies);
      res.json({ currency, country });
    } catch {
      res.json({ currency: "INR", country: "IN" });
    }
  });

  app.get("/api/currency/config", async (_req, res) => {
    try {
      const [rules, rates] = await Promise.all([
        storage.getPricingRules(),
        storage.getCurrencyRates(),
      ]);
      const ratesMap: Record<string, number> = {};
      for (const r of rates) ratesMap[r.currency] = r.rateFromInr;

      const enabledRules = rules.filter(r => r.enabled);

      res.json({
        rules: enabledRules.map(r => ({
          currency: r.currency,
          symbol: r.symbol,
          displayName: r.displayName,
          markupPercent: r.markupPercent,
          roundingRule: r.roundingRule,
          enabled: r.enabled,
        })),
        rates: ratesMap,
      });
    } catch {
      res.json({ rules: [], rates: {} });
    }
  });

  app.get("/api/admin/pricing-rules", requirePermission("pricing"), async (_req, res) => {
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

  app.get("/api/admin/currency-status", requirePermission("pricing"), async (_req, res) => {
    try {
      const [rules, rateRows] = await Promise.all([
        storage.getPricingRules(),
        storage.getCurrencyRates(),
      ]);
      const status = getRateServiceStatus();
      const rateMap: Record<string, { rateFromInr: number; updatedAt: Date }> = {};
      for (const r of rateRows) rateMap[r.currency] = { rateFromInr: r.rateFromInr, updatedAt: r.updatedAt };

      const totalEnabled = rules.filter(r => r.enabled).length;
      const totalDisabled = rules.filter(r => !r.enabled).length;

      res.json({
        ...status,
        totalEnabled,
        totalDisabled,
        rates: rules.map(r => ({
          currency: r.currency,
          symbol: r.symbol,
          displayName: r.displayName,
          enabled: r.enabled,
          rateFromInr: rateMap[r.currency]?.rateFromInr ?? null,
          updatedAt: rateMap[r.currency]?.updatedAt ?? null,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch currency status" });
    }
  });

  app.put("/api/admin/pricing-rules/:currency", requirePermission("pricing"), async (req, res) => {
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

  app.post("/api/admin/pricing-rules/refresh-rates", requirePermission("pricing"), async (_req, res) => {
    try {
      await fetchAndStoreRates();
    } catch (err: any) {
      const message = err?.message ?? "Failed to fetch rates from upstream";
      console.error("[ExchangeRate] Manual refresh failed:", message);
      return res.status(502).json({ message: `Exchange rate fetch failed: ${message}` });
    }
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
      res.status(500).json({ message: "Failed to refresh rates" });
    }
  });
}
