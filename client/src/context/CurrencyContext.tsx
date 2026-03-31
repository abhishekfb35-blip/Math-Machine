import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface CurrencyRule {
  currency: string;
  symbol: string;
  displayName: string;
  markupPercent: number;
  roundingRule: string;
  enabled: boolean;
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

const INR_RULE: CurrencyRule = {
  currency: "INR",
  symbol: "₹",
  displayName: "Indian Rupee",
  markupPercent: 0,
  roundingRule: "nearest",
  enabled: true,
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  symbol: "₹",
  setCurrency: () => {},
  convertPrice: (x) => x,
  formatPrice: (x) => `₹${x.toLocaleString("en-IN")}`,
  availableCurrencies: [INR_RULE],
  isLoading: false,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency] = useState<string>("INR");

  const setCurrency = useCallback((_code: string) => {}, []);
  const convertPrice = useCallback((inrAmount: number) => inrAmount, []);
  const formatPrice = useCallback(
    (inrAmount: number) => `₹${inrAmount.toLocaleString("en-IN")}`,
    []
  );

  const value: CurrencyContextValue = {
    currency,
    symbol: "₹",
    setCurrency,
    convertPrice,
    formatPrice,
    availableCurrencies: [INR_RULE],
    isLoading: false,
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
