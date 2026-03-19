import { storage } from "../storage";

const FRANKFURTER_API = "https://api.frankfurter.app/latest";
const FRANKFURTER_CURRENCIES = ["GBP", "USD", "EUR", "SGD", "AUD", "CAD"];
const AED_USD_PEG = 3.6725;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const DEFAULT_PRICING_RULES = [
  { currency: "GBP", symbol: "£", displayName: "British Pound", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "USD", symbol: "$", displayName: "US Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "EUR", symbol: "€", displayName: "Euro", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "AED", symbol: "AED", displayName: "UAE Dirham", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "SGD", symbol: "S$", displayName: "Singapore Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "AUD", symbol: "A$", displayName: "Australian Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
  { currency: "CAD", symbol: "C$", displayName: "Canadian Dollar", markupPercent: 0, roundingRule: "nearest", enabled: true },
];

let lastFetchAt: Date | null = null;
let lastFetchError: string | null = null;
let lastFetchDateStr: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function isFetchedToday(): boolean {
  if (!lastFetchAt) return false;
  const now = new Date();
  const f = lastFetchAt;
  return (
    f.getUTCFullYear() === now.getUTCFullYear() &&
    f.getUTCMonth() === now.getUTCMonth() &&
    f.getUTCDate() === now.getUTCDate()
  );
}

export async function fetchAndStoreRates(): Promise<void> {
  try {
    const url = `${FRANKFURTER_API}?from=INR&to=${FRANKFURTER_CURRENCIES.join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { date?: string; rates?: Record<string, number> };
    if (!data.rates) throw new Error("No rates in response");

    for (const currency of FRANKFURTER_CURRENCIES) {
      const rate = data.rates[currency];
      if (rate && rate > 0) {
        await storage.upsertCurrencyRate(currency, rate);
      }
    }

    const usdRate = data.rates["USD"];
    if (usdRate && usdRate > 0) {
      const aedRate = usdRate * AED_USD_PEG;
      await storage.upsertCurrencyRate("AED", aedRate);
    }

    lastFetchAt = new Date();
    lastFetchDateStr = data.date ?? null;
    lastFetchError = null;
    console.log("[ExchangeRate] Rates updated from frankfurter.app, date:", lastFetchDateStr);
  } catch (err: any) {
    lastFetchError = err?.message ?? "Unknown error";
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

async function maybeRefreshDaily(): Promise<void> {
  if (!isFetchedToday()) {
    await fetchAndStoreRates();
  }
}

export async function initializeExchangeRateService(): Promise<void> {
  await seedDefaultPricingRules();

  try {
    const existingRates = await storage.getCurrencyRates();
    if (existingRates.length > 0) {
      const newest = existingRates.reduce(
        (max, r) => new Date(r.updatedAt) > max ? new Date(r.updatedAt) : max,
        new Date(existingRates[0].updatedAt)
      );
      lastFetchAt = newest;
    }
  } catch {}

  await maybeRefreshDaily();

  if (!refreshTimer) {
    refreshTimer = setInterval(maybeRefreshDaily, TWENTY_FOUR_HOURS);
  }
}

export function getRateServiceStatus(): {
  fetchedToday: boolean;
  lastFetchedAt: string | null;
  lastFetchDateStr: string | null;
  lastFetchError: string | null;
  nextRefreshAt: string | null;
} {
  const nextRefreshAt = lastFetchAt
    ? new Date(lastFetchAt.getTime() + TWENTY_FOUR_HOURS).toISOString()
    : null;
  return {
    fetchedToday: isFetchedToday(),
    lastFetchedAt: lastFetchAt?.toISOString() ?? null,
    lastFetchDateStr,
    lastFetchError,
    nextRefreshAt,
  };
}

export function applyRounding(amount: number, rule: string): number {
  if (rule === "up99") {
    return Math.ceil(amount + 0.01) - 0.01;
  }
  if (rule === "up") return Math.ceil(amount);
  return Math.round(amount * 100) / 100;
}

export async function convertFromINR(
  inrAmount: number,
  toCurrency: string
): Promise<{ amount: number; currency: string }> {
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
