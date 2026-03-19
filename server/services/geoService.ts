const GEO_API = "http://ip-api.com/json";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface GeoResult {
  country: string;
  currency: string;
}

const ipCache = new Map<string, { result: GeoResult; expiresAt: number }>();

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  SG: "SGD",
  AE: "AED",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  FI: "EUR",
  IE: "EUR",
  GR: "EUR",
  LU: "EUR",
  MT: "EUR",
  CY: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  HR: "EUR",
};

const SUPPORTED_CURRENCIES = new Set(["GBP", "USD", "EUR", "AED", "SGD", "AUD", "CAD"]);

export async function detectCurrency(
  ip: string,
  enabledCurrencies?: Set<string>
): Promise<GeoResult> {
  const allowed = enabledCurrencies ?? SUPPORTED_CURRENCIES;
  const cleanIp = ip.replace(/^::ffff:/, "").trim();

  if (!cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost") {
    return { country: "IN", currency: "INR" };
  }

  const cached = ipCache.get(cleanIp);
  if (cached && cached.expiresAt > Date.now()) {
    const currency = allowed.has(cached.result.currency) ? cached.result.currency : "INR";
    return { ...cached.result, currency };
  }

  try {
    const res = await fetch(`${GEO_API}/${cleanIp}?fields=countryCode,currency`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { countryCode?: string; currency?: string; status?: string };
    if (data.status === "fail") throw new Error("geo failed");

    const country = data.countryCode?.toUpperCase() ?? "IN";
    let currency = data.currency?.toUpperCase() ?? "INR";
    if (!allowed.has(currency)) {
      currency = COUNTRY_TO_CURRENCY[country] ?? "INR";
      if (!allowed.has(currency)) currency = "INR";
    }

    const result: GeoResult = { country, currency };
    ipCache.set(cleanIp, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return { country: "IN", currency: "INR" };
  }
}
