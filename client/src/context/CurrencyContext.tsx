import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface CurrencyRule {
  code: string;
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

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  symbol: "₹",
  setCurrency: () => {},
  convertPrice: (x) => x,
  formatPrice: (x) => `₹${x.toLocaleString("en-IN")}`,
  availableCurrencies: [],
  isLoading: true,
});

function applyRounding(amount: number, rule: string): number {
  if (rule === "up99") {
    const intPart = Math.ceil(amount);
    return intPart - 0.01;
  }
  if (rule === "up") return Math.ceil(amount);
  return Math.round(amount * 100) / 100;
}

function formatAmount(amount: number, currency: string, symbol: string): string {
  if (currency === "INR") {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  }
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${symbol}${Number(formatted).toLocaleString("en-US")}`;
}

const STORAGE_KEY = "tl_currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "INR";
  });

  const { data: config, isLoading: configLoading } = useQuery<CurrencyConfig>({
    queryKey: ["/api/currency/config"],
    staleTime: 6 * 60 * 60 * 1000,
  });

  const { data: geo } = useQuery<GeoData>({
    queryKey: ["/api/geo"],
    staleTime: 60 * 60 * 1000,
    enabled: !localStorage.getItem(STORAGE_KEY),
  });

  useEffect(() => {
    if (geo && !localStorage.getItem(STORAGE_KEY) && config) {
      const enabled = config.rules.filter(r => r.enabled).map(r => r.code);
      if (geo.currency === "INR" || enabled.includes(geo.currency)) {
        setCurrencyState(geo.currency);
      }
    }
  }, [geo, config]);

  const setCurrency = useCallback((code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setCurrencyState(code);
  }, []);

  const enabledRules = config?.rules.filter(r => r.enabled) ?? [];
  const allCurrencies: CurrencyRule[] = [
    { code: "INR", symbol: "₹", displayName: "Indian Rupee", markupPercent: 0, roundingRule: "nearest", enabled: true },
    ...enabledRules,
  ];

  const currentRule = config?.rules.find(r => r.code === currency);

  const convertPrice = useCallback((inrAmount: number): number => {
    if (currency === "INR") return inrAmount;
    if (!config) return inrAmount;
    const rate = config.rates[currency];
    if (!rate) return inrAmount;
    const rule = config.rules.find(r => r.code === currency);
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
