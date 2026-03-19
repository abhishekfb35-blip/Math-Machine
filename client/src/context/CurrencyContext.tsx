import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface CurrencyRule {
  currency: string;
  symbol: string;
  displayName: string;
  markupPercent: number;
  roundingRule: string;
  enabled: boolean;
}

interface CurrencyConfig {
  rules: CurrencyRule[];
  rates: Record<string, number>;
}

interface GeoData {
  currency: string;
  country: string;
}

interface CurrencyContextValue {
  currency: string;
  symbol: string;
  setCurrency: (code: string) => void;
  convertPrice: (inrAmount: number) => number;
  formatPrice: (inrAmount: number) => string;
  availableCurrencies: CurrencyRule[];
  isLoading: boolean;
}

const COOKIE_NAME = "tl_currency";
const COOKIE_DAYS = 7;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookieValue(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  symbol: "₹",
  setCurrency: () => {},
  convertPrice: (x) => x,
  formatPrice: (x) => `₹${Math.round(x).toLocaleString("en-IN")}`,
  availableCurrencies: [],
  isLoading: true,
});

function applyRounding(amount: number, rule: string): number {
  if (rule === "up99") {
    return Math.ceil(amount + 0.01) - 0.01;
  }
  if (rule === "up") return Math.ceil(amount);
  return Math.round(amount);
}

function formatAmount(amount: number, currencyCode: string, sym: string): string {
  if (currencyCode === "INR") {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  }
  return `${sym}${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    return getCookie(COOKIE_NAME) || "INR";
  });

  const { data: config, isLoading: configLoading } = useQuery<CurrencyConfig>({
    queryKey: ["/api/currency/config"],
    staleTime: 6 * 60 * 60 * 1000,
  });

  const { data: geo } = useQuery<GeoData>({
    queryKey: ["/api/geo"],
    staleTime: 60 * 60 * 1000,
    enabled: !getCookie(COOKIE_NAME),
  });

  useEffect(() => {
    if (geo && !getCookie(COOKIE_NAME) && config) {
      const enabledCodes = config.rules.filter(r => r.enabled).map(r => r.currency);
      if (geo.currency === "INR" || enabledCodes.includes(geo.currency)) {
        setCurrencyState(geo.currency);
        setCookieValue(COOKIE_NAME, geo.currency, COOKIE_DAYS);
      }
    }
  }, [geo, config]);

  const setCurrency = useCallback((code: string) => {
    setCookieValue(COOKIE_NAME, code, COOKIE_DAYS);
    setCurrencyState(code);
  }, []);

  const enabledRules = config?.rules.filter(r => r.enabled) ?? [];
  const allCurrencies: CurrencyRule[] = [
    { currency: "INR", symbol: "₹", displayName: "Indian Rupee", markupPercent: 0, roundingRule: "nearest", enabled: true },
    ...enabledRules,
  ];

  const currentRule = config?.rules.find(r => r.currency === currency);

  const convertPrice = useCallback((inrAmount: number): number => {
    if (currency === "INR") return inrAmount;
    if (!config) return inrAmount;
    const rate = config.rates[currency];
    if (!rate) return inrAmount;
    const rule = config.rules.find(r => r.currency === currency);
    if (!rule?.enabled) return inrAmount;
    const markupFactor = 1 + (rule.markupPercent || 0) / 100;
    const raw = inrAmount * rate * markupFactor;
    return applyRounding(raw, rule.roundingRule);
  }, [currency, config]);

  const symbol = currency === "INR" ? "₹" : (currentRule?.symbol ?? currency);

  const formatPrice = useCallback((inrAmount: number): string => {
    if (currency === "INR") {
      return `₹${Math.round(inrAmount).toLocaleString("en-IN")}`;
    }
    const converted = convertPrice(inrAmount);
    return formatAmount(converted, currency, symbol);
  }, [currency, symbol, convertPrice]);

  const value: CurrencyContextValue = {
    currency,
    symbol,
    setCurrency,
    convertPrice,
    formatPrice,
    availableCurrencies: allCurrencies,
    isLoading: configLoading,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
