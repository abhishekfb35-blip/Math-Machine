export interface CartDiscountThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

export function getCartDiscountLabel(
  itemCount: number,
  thresholds: CartDiscountThresholds | null | undefined,
): string {
  const {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  } = thresholds ?? {
    retailFreeItemTrigger: 3,
    retailBonusDiscountPct: 30,
    wholesaleThreshold: 5,
  };

  if (itemCount >= wholesale) return "Best Rates";
  if (itemCount >= trigger + 1) return `1 Free Item + ${bonusPct}% Off*`;
  return `Buy ${trigger - 1} Get 1 Free*`;
}