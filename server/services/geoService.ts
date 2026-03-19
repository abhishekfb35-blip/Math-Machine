const GEO_API = "http://ip-api.com/json";

const IP_TO_CURRENCY: Record<string, string> = {
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

export async function getCurrencyForIp(ip: string): Promise<string> {
  try {
    const cleanIp = ip.replace(/^::ffff:/, "");
    if (!cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost") {
      return "INR";
    }
    const res = await fetch(`${GEO_API}/${cleanIp}?fields=countryCode,currency`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "INR";
    const data = await res.json() as { countryCode?: string; currency?: string; status?: string };
    if (data.status === "fail") return "INR";
    const apiCurrency = data.currency?.toUpperCase();
    if (apiCurrency && SUPPORTED_CURRENCIES.has(apiCurrency)) return apiCurrency;
    const countryCode = data.countryCode?.toUpperCase();
    if (countryCode) {
      const mapped = IP_TO_CURRENCY[countryCode];
      if (mapped && SUPPORTED_CURRENCIES.has(mapped)) return mapped;
    }
    return "INR";
  } catch {
    return "INR";
  }
}
