import { storage } from "../storage";

const RATE_API = "https://open.er-api.com/v6/latest/INR";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_PRICING_RULES = [
  { currency: "GBP", symbol: "£", displayName: "British Pound", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "USD", symbol: "$", displayName: "US Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "EUR", symbol: "€", displayName: "Euro", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "AED", symbol: "AED", displayName: "UAE Dirham", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "SGD", symbol: "S$", displayName: "Singapore Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "AUD", symbol: "A$", displayName: "Australian Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "CAD", symbol: "C$", displayName: "Canadian Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
];

const SUPPORTED_CURRENCIES = DEFAULT_PRICING_RULES.map(r => r.currency);

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastFetchAt: Date | null = null;
let lastFetchError: string | null = null;

export async function fetchAndStoreRates(): Promise<void> {
  try {
    const res = await fetch(RATE_API, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) throw new Error("Invalid API response");
    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = data.rates[currency];
      if (rate && rate > 0) {
        await storage.upsertCurrencyRate(currency, rate);
      }
    }
    lastFetchAt = new Date();
    lastFetchError = null;
    console.log("[ExchangeRate] Rates updated:", SUPPORTED_CURRENCIES.join(", "));
  } catch (err: any) {
    lastFetchError = err?.message || "Unknown error";
    console.error("[ExchangeRate] Failed to fetch rates:", lastFetchError);
  }
}

async function seedDefaultPricingRules(): Promise<void> {
  try {
    const existing = await storage.getPricingRules();
    const existingCurrencies = new Set(existing.map(r => r.currency));
    for (const rule of DEFAULT_PRICING_RULES) {
      if (!existingCurrencies.has(rule.currency)) {
        await storage.upsertPricingRule(rule);
      }
    }
  } catch (err) {
    console.error("[ExchangeRate] Failed to seed pricing rules:", err);
  }
}

export async function initializeExchangeRateService(): Promise<void> {
  await seedDefaultPricingRules();
  const existingRates = await storage.getCurrencyRates().catch(() => []);
  if (existingRates.length === 0) {
    await fetchAndStoreRates();
  } else {
    const oldest = existingRates.reduce((min, r) => r.updatedAt < min ? r.updatedAt : min, existingRates[0].updatedAt);
    const ageMs = Date.now() - new Date(oldest).getTime();
    if (ageMs > REFRESH_INTERVAL_MS) {
      await fetchAndStoreRates();
    } else {
      lastFetchAt = new Date(oldest);
    }
  }
  if (!refreshTimer) {
    refreshTimer = setInterval(fetchAndStoreRates, REFRESH_INTERVAL_MS);
  }
}

export function getRateServiceStatus(): { lastFetchAt: Date | null; lastFetchError: string | null; nextRefreshAt: Date | null } {
  return {
    lastFetchAt,
    lastFetchError,
    nextRefreshAt: lastFetchAt ? new Date(lastFetchAt.getTime() + REFRESH_INTERVAL_MS) : null,
  };
}

export function applyRounding(amount: number, rule: string): number {
  if (rule === "floor") return Math.floor(amount);
  if (rule === "ceil") return Math.ceil(amount);
  if (rule === "nearest_5") return Math.round(amount / 5) * 5;
  if (rule === "nearest_10") return Math.round(amount / 10) * 10;
  return Math.round(amount * 100) / 100;
}

export async function convertFromINR(inrAmount: number, toCurrency: string): Promise<{ amount: number; currency: string }> {
  if (toCurrency === "INR") return { amount: inrAmount, currency: "INR" };
  try {
    const rates = await storage.getCurrencyRates();
    const rateRow = rates.find(r => r.currency === toCurrency);
    if (!rateRow) return { amount: inrAmount, currency: "INR" };
    const rule = await storage.getPricingRuleByCurrency(toCurrency);
    if (!rule?.enabled) return { amount: inrAmount, currency: "INR" };
    const markupFactor = 1 + (rule.markupPercent || 0) / 100;
    const raw = inrAmount * rateRow.rateFromInr * markupFactor;
    return { amount: applyRounding(raw, rule.roundingRule), currency: toCurrency };
  } catch {
    return { amount: inrAmount, currency: "INR" };
  }
}
