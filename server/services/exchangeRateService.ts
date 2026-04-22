import { storage } from "../storage";
import { notificationService } from "../providers/notification";

const FRANKFURTER_API = "https://api.frankfurter.app/latest";
const FRANKFURTER_CURRENCIES = ["GBP", "USD", "EUR", "SGD", "AUD", "CAD"];
const AED_USD_PEG = 3.6725;
const DEFAULT_SYNC_HOURS = 24;

function getSyncIntervalMs(): number {
  const hours = parseInt(process.env.EXCHANGE_RATE_SYNC_INTERVAL_HOURS ?? "", 10);
  if (!isNaN(hours) && hours > 0) {
    return hours * 60 * 60 * 1000;
  }
  return DEFAULT_SYNC_HOURS * 60 * 60 * 1000;
}

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
let lastExchangeRateAlertAt = 0;

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
    throw err;
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

function shouldRefreshNow(): boolean {
  if (!lastFetchAt) return true;
  return Date.now() - lastFetchAt.getTime() >= getSyncIntervalMs();
}

async function maybeFireStaleAlert(): Promise<void> {
  try {
    const cfgRecord = await storage.getSiteConfig("exchange-rate-alert-config");
    const cfg = cfgRecord ? JSON.parse(cfgRecord.value) : {};
    const alertEmail: string = cfg.alertEmail?.trim() || "";
    const staleHours: number = typeof cfg.staleHoursThreshold === "number" ? cfg.staleHoursThreshold : 48;
    const cooldownHours: number = typeof cfg.cooldownHours === "number" ? cfg.cooldownHours : 24;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    if (!alertEmail) return;

    const staleSinceMs = lastFetchAt ? Date.now() - lastFetchAt.getTime() : Infinity;
    const staleThresholdMs = staleHours * 60 * 60 * 1000;
    if (staleSinceMs < staleThresholdMs) return;

    const now = Date.now();
    if (now - lastExchangeRateAlertAt < cooldownMs) return;

    lastExchangeRateAlertAt = now;
    const result = await notificationService.sendExchangeRateAlert({
      toEmail: alertEmail,
      lastSuccessAt: lastFetchAt?.toISOString() ?? null,
      staleHoursThreshold: staleHours,
      lastError: lastFetchError,
    });

    if (result.success) {
      console.log(`[ExchangeRate] Stale rate alert sent to ${alertEmail}`);
    } else {
      console.error(`[ExchangeRate] Alert send failed: ${result.error}`);
    }
  } catch (e: any) {
    console.error("[ExchangeRate] Alert check error:", e.message);
  }
}

async function maybeRefreshScheduled(): Promise<void> {
  if (shouldRefreshNow()) {
    try {
      await fetchAndStoreRates();
    } catch (err: any) {
      console.error("[ExchangeRate] Scheduled fetch failed:", lastFetchError);
      await maybeFireStaleAlert();
    }
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

  await maybeRefreshScheduled();

  const intervalMs = getSyncIntervalMs();
  if (!refreshTimer) {
    refreshTimer = setInterval(maybeRefreshScheduled, intervalMs);
    console.log(`[ExchangeRate] Auto-refresh scheduled every ${intervalMs / 3600000}h`);
  }
}

export function getRateServiceStatus(): {
  fetchedToday: boolean;
  isFresh: boolean;
  lastFetchedAt: string | null;
  lastFetchDateStr: string | null;
  lastFetchError: string | null;
  nextRefreshAt: string | null;
  syncIntervalHours: number;
} {
  const intervalMs = getSyncIntervalMs();
  const nextRefreshAt = lastFetchAt
    ? new Date(lastFetchAt.getTime() + intervalMs).toISOString()
    : null;
  return {
    fetchedToday: isFetchedToday(),
    isFresh: !shouldRefreshNow(),
    lastFetchedAt: lastFetchAt?.toISOString() ?? null,
    lastFetchDateStr,
    lastFetchError,
    nextRefreshAt,
    syncIntervalHours: intervalMs / 3600000,
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
