import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useCurrency } from "@/context/CurrencyContext";

export default function CurrencySelector() {
  const { currency, setCurrency, availableCurrencies } = useCurrency();

  if (availableCurrencies.length <= 1) return null;

  const selected = availableCurrencies.find(c => c.currency === currency);

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger
        className="h-8 w-auto min-w-0 gap-0.5 border-none bg-transparent shadow-none text-xs font-medium px-2 focus:ring-0"
        data-testid="select-currency-trigger"
      >
        <span className="font-medium">{currency}</span>
        <span className="text-muted-foreground">{selected?.symbol}</span>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[130px]">
        {availableCurrencies.map(c => (
          <SelectItem key={c.currency} value={c.currency} data-testid={`currency-option-${c.currency}`}>
            <span className="font-medium">{c.currency}</span>
            <span className="text-muted-foreground ml-1 text-xs">{c.symbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
