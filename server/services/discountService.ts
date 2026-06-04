export interface CartEngineConfig {
  wholesaleThreshold: number;
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
}

export interface CartBanners {
  state1to2: string;
  state3: string;
  state4: string;
  state5plus: string;
}

export interface DeliveryTier {
  minItems: number;
  maxItems: number;
  fee: number;
}

export interface PricingResult {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  freeIndices: number[];
  bonusDiscountIndex: number | null;
  bonusDiscountPct: number;
}

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

export interface CartPricingItem {
  price: number;
  wholesalePrice: number | null;
  quantity: number;
}

export function calculateCartPricing(
  items: CartPricingItem[],
  engineConfig: CartEngineConfig | null,
  deliveryTiers: DeliveryTier[],
  isDomestic: boolean,
): PricingResult {
  const expanded: { price: number; wholesalePrice: number | null }[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ price: item.price, wholesalePrice: item.wholesalePrice });
    }
  }

  const subtotal = expanded.reduce((sum, e) => sum + e.price, 0);
  const count = expanded.length;

  if (!engineConfig || count === 0) {
    const shippingFee = calculateShippingFee(count, deliveryTiers, isDomestic);
    return { subtotal, discount: 0, shippingFee, total: subtotal + shippingFee, freeIndices: [], bonusDiscountIndex: null, bonusDiscountPct: 0 };
  }

  const { wholesaleThreshold, retailFreeItemTrigger, retailBonusDiscountPct } = engineConfig;

  const shippingFee = calculateShippingFee(count, deliveryTiers, isDomestic);

  if (count >= wholesaleThreshold) {
    let wholesaleTotal = 0;
    for (const e of expanded) {
      wholesaleTotal += (e.wholesalePrice !== null && e.wholesalePrice !== undefined)
        ? e.wholesalePrice
        : e.price;
    }
    const discount = subtotal - wholesaleTotal;
    return { subtotal, discount, shippingFee, total: wholesaleTotal + shippingFee, freeIndices: [], bonusDiscountIndex: null, bonusDiscountPct: 0 };
  }

  const sorted = [...expanded].map((e, idx) => ({ ...e, idx })).sort((a, b) => a.price - b.price);

  if (count === retailFreeItemTrigger) {
    const cheapest = sorted[0];
    return {
      subtotal,
      discount: cheapest.price,
      shippingFee,
      total: subtotal - cheapest.price + shippingFee,
      freeIndices: [cheapest.idx],
      bonusDiscountIndex: null,
      bonusDiscountPct: 0,
    };
  }

  if (count === retailFreeItemTrigger + 1) {
    const cheapest = sorted[0];
    const secondCheapest = sorted[1];
    const bonusDiscount = Math.round(secondCheapest.price * (retailBonusDiscountPct / 100));
    const discount = cheapest.price + bonusDiscount;
    return {
      subtotal,
      discount,
      shippingFee,
      total: subtotal - discount + shippingFee,
      freeIndices: [cheapest.idx],
      bonusDiscountIndex: secondCheapest.idx,
      bonusDiscountPct: retailBonusDiscountPct,
    };
  }

  return { subtotal, discount: 0, shippingFee, total: subtotal + shippingFee, freeIndices: [], bonusDiscountIndex: null, bonusDiscountPct: 0 };
}

export function resolveActiveBanner(itemCount: number, banners: CartBanners | null, config: CartEngineConfig): string {
  if (!banners) return "";
  if (itemCount >= config.wholesaleThreshold) return banners.state5plus || "";
  if (itemCount >= config.retailFreeItemTrigger + 1) return banners.state4 || "";
  if (itemCount >= config.retailFreeItemTrigger) return banners.state3 || "";
  return banners.state1to2 || "";
}
