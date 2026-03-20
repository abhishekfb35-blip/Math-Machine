export interface OfferTier {
  label: string;
  buyCount: number;
  freeCount: number;
  enabled: boolean;
}

export interface DeliveryTier {
  minItems: number;
  maxItems: number;
  fee: number;
}

export const defaultOfferTiers: OfferTier[] = [
  { label: "Buy 2 Get 1 Free", buyCount: 2, freeCount: 1, enabled: true },
  { label: "Buy 3 Get 2 Free", buyCount: 3, freeCount: 2, enabled: true },
];

export const defaultDeliveryTiers: DeliveryTier[] = [
  { minItems: 3, maxItems: 5, fee: 300 },
  { minItems: 6, maxItems: 10, fee: 500 },
  { minItems: 11, maxItems: 15, fee: 700 },
];

export interface PricingResult {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  freeIndices: number[];
}

/**
 * Optimal (DP/unbounded knapsack) algorithm to maximize free items.
 * For each item count n, computes the maximum free items achievable using
 * any combination of active offer tiers (applied as many times as possible).
 */
export function computeNumFree(totalItems: number, tiers: OfferTier[]): number {
  const activeTiers = tiers.filter(
    t => t.enabled && t.buyCount > 0 && t.freeCount > 0,
  );

  if (activeTiers.length === 0 || totalItems <= 0) return 0;

  const dp = new Array<number>(totalItems + 1).fill(0);

  for (let n = 1; n <= totalItems; n++) {
    for (const tier of activeTiers) {
      const groupSize = tier.buyCount + tier.freeCount;
      if (n >= groupSize) {
        const candidate = dp[n - groupSize] + tier.freeCount;
        if (candidate > dp[n]) dp[n] = candidate;
      }
    }
  }

  return dp[totalItems];
}

/**
 * Returns the domestic delivery fee (INR) for a given paid item count.
 * Delivery is always free outside configured ranges (or if 0 tiers match).
 * International orders should pass isDomestic=false to get 0.
 */
export function calculateShippingFee(
  itemCount: number,
  tiers: DeliveryTier[],
  isDomestic: boolean,
): number {
  if (!isDomestic) return 0;
  for (const tier of tiers) {
    if (itemCount >= tier.minItems && itemCount <= tier.maxItems) {
      return tier.fee;
    }
  }
  return 0;
}

export function calculateDiscount(
  items: { price: number; quantity: number }[],
  offerTiers: OfferTier[] = defaultOfferTiers,
  deliveryTiers: DeliveryTier[] = defaultDeliveryTiers,
  isDomestic: boolean = true,
): PricingResult {
  const expanded: { price: number; originalIndex: number }[] = [];
  items.forEach((item, idx) => {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ price: item.price, originalIndex: idx });
    }
  });

  const subtotal = expanded.reduce((sum, item) => sum + item.price, 0);
  const count = expanded.length;

  const shippingFee = calculateShippingFee(count, deliveryTiers, isDomestic);

  const minTrigger = offerTiers
    .filter(t => t.enabled && t.buyCount > 0 && t.freeCount > 0)
    .reduce((min, t) => Math.min(min, t.buyCount + t.freeCount), Infinity);

  if (count < minTrigger || !isFinite(minTrigger)) {
    return { subtotal, discount: 0, shippingFee, total: subtotal + shippingFee, freeIndices: [] };
  }

  expanded.sort((a, b) => b.price - a.price);

  const numFree = computeNumFree(count, offerTiers);
  let discount = 0;
  const freeIndices: number[] = [];

  for (let i = count - 1; i >= count - numFree && i >= 0; i--) {
    discount += expanded[i].price;
    freeIndices.push(i);
  }

  return { subtotal, discount, shippingFee, total: subtotal - discount + shippingFee, freeIndices };
}
