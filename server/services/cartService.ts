import type { IStorage } from "../storage";
import type { CartItem, Product } from "@shared/types";
import {
  calculateCartPricing,
  calculateShippingFee,
  type PricingResult,
  type CartEngineConfig,
  type DeliveryTier,
} from "./discountService";

export interface EnrichedCartItem extends CartItem {
  product: Product | undefined;
  effectivePrice: number;
  originalEffectivePrice: number;
  isFreeItem: boolean;
  bonusDiscountPct: number;
}

export interface CartDetails {
  id: string;
  items: EnrichedCartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  freeIndices: number[];
  engineThresholds: {
    retailFreeItemTrigger: number;
    retailBonusDiscountPct: number;
    wholesaleThreshold: number;
  } | null;
}

export class CartService {
  constructor(private storage: IStorage) {}

  async getCartDetails(sessionId: string, isDomestic: boolean = true): Promise<CartDetails> {
    const cart = await this.storage.getOrCreateCart(sessionId);
    const items = await this.storage.getCartItems(cart.id);
    const enrichedItems = await this.enrichItemsWithProducts(items);

    const engineConfig = await this.loadEngineConfig();
    const deliveryTiers = await this.loadDeliveryTiers();

    const priceItems = enrichedItems
      .filter(i => i.product)
      .map(i => ({
        price: i.effectivePrice,
        wholesalePrice: i.product?.wholesalePrice ?? null,
        quantity: i.quantity,
      }));

    const pricing = calculateCartPricing(priceItems, engineConfig, deliveryTiers, isDomestic);

    // Build an expanded-list index → pricedItems index mapping.
    // This mirrors the expansion order inside calculateCartPricing so the indices line up.
    const pricedItems = enrichedItems.filter(i => i.product);
    const expandedRefs: number[] = [];
    for (let pi = 0; pi < pricedItems.length; pi++) {
      for (let qi = 0; qi < pricedItems[pi].quantity; qi++) {
        expandedRefs.push(pi);
      }
    }

    // Apply per-item discount adjustments back onto enrichedItems rows.
    // For qty > 1 same-product rows we apply the discount to the whole row; acceptable
    // for a luxury personalised-goods store where duplicate-SKU qty is uncommon.
    const { bonusDiscountIndex, bonusDiscountPct, freeIndices, ...pricingFields } = pricing;

    for (const freeIdx of freeIndices) {
      const pricedIdx = expandedRefs[freeIdx];
      if (pricedIdx !== undefined) {
        const target = pricedItems[pricedIdx];
        const ei = enrichedItems.indexOf(target);
        if (ei >= 0) {
          enrichedItems[ei] = { ...enrichedItems[ei], effectivePrice: 0, isFreeItem: true };
        }
      }
    }

    if (bonusDiscountIndex !== null) {
      const pricedIdx = expandedRefs[bonusDiscountIndex];
      if (pricedIdx !== undefined) {
        const target = pricedItems[pricedIdx];
        const ei = enrichedItems.indexOf(target);
        if (ei >= 0 && !enrichedItems[ei].isFreeItem) {
          const originalPrice = enrichedItems[ei].effectivePrice;
          enrichedItems[ei] = {
            ...enrichedItems[ei],
            effectivePrice: Math.round(originalPrice * (1 - bonusDiscountPct / 100)),
            bonusDiscountPct,
          };
        }
      }
    }

    const itemCount = enrichedItems.reduce((sum, i) => sum + i.quantity, 0);

    const engineThresholds = engineConfig
      ? {
          retailFreeItemTrigger: engineConfig.retailFreeItemTrigger,
          retailBonusDiscountPct: engineConfig.retailBonusDiscountPct,
          wholesaleThreshold: engineConfig.wholesaleThreshold,
        }
      : null;

    return {
      id: cart.id,
      items: enrichedItems,
      itemCount,
      ...pricingFields,
      freeIndices,
      engineThresholds,
    };
  }

  async addItem(
    sessionId: string,
    productId: string,
    quantity: number,
    personalizationName: string | null,
    selectedColor?: string | null,
    selectedSize?: string | null
  ): Promise<{ item: CartItem; isNew: boolean }> {
    const product = await this.storage.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const cart = await this.storage.getOrCreateCart(sessionId);
    const existingItems = await this.storage.getCartItems(cart.id);
    const existing = existingItems.find(
      i =>
        i.productId === productId &&
        i.personalizationName === (personalizationName || null) &&
        (i.selectedColor || null) === (selectedColor || null) &&
        (i.selectedSize || null) === (selectedSize || null)
    );

    if (existing) {
      const updated = await this.storage.updateCartItem(existing.id, existing.quantity + quantity);
      return { item: updated!, isNew: false };
    }

    const item = await this.storage.addCartItem({
      cartId: cart.id,
      productId,
      quantity,
      personalizationName: personalizationName || null,
      selectedColor: selectedColor || null,
      selectedSize: selectedSize || null,
    });

    return { item, isNew: true };
  }

  async updateItem(itemId: string, quantity: number, personalizationName?: string, selectedColor?: string | null, selectedSize?: string | null): Promise<{ deleted: true } | CartItem> {
    if (quantity === 0) {
      await this.storage.removeCartItem(itemId);
      return { deleted: true };
    }
    const updated = await this.storage.updateCartItem(itemId, quantity, personalizationName, selectedColor, selectedSize);
    if (!updated) {
      throw new NotFoundError("Item not found");
    }
    return updated;
  }

  async removeItem(itemId: string): Promise<void> {
    await this.storage.removeCartItem(itemId);
  }

  private async loadEngineConfig(): Promise<CartEngineConfig | null> {
    try {
      const config = await this.storage.getSiteContent("cart-engine-config");
      if (config) {
        const parsed = JSON.parse(config.value);
        if (
          parsed &&
          typeof parsed.wholesaleThreshold === "number" &&
          typeof parsed.retailFreeItemTrigger === "number" &&
          typeof parsed.retailBonusDiscountPct === "number"
        ) {
          return parsed as CartEngineConfig;
        }
      }
    } catch {}
    return null;
  }

  private async loadDeliveryTiers(): Promise<DeliveryTier[]> {
    try {
      const config = await this.storage.getSiteContent("delivery-tiers");
      if (config) {
        const parsed = JSON.parse(config.value);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }

  private async enrichItemsWithProducts(items: CartItem[]): Promise<EnrichedCartItem[]> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.storage.getProductById(item.productId);
        let effectivePrice = product?.price ?? 0;
        if (product && item.selectedSize) {
          try {
            const variantOptions = await this.storage.getProductVariantOptions(item.productId);
            const sizeConfig = variantOptions.sizes.find(s => s.name === item.selectedSize);
            if (sizeConfig && sizeConfig.priceAdd > 0) {
              effectivePrice = product.price + sizeConfig.priceAdd;
            }
          } catch {}
        }
        return {
          ...item,
          product,
          effectivePrice,
          originalEffectivePrice: effectivePrice,
          isFreeItem: false,
          bonusDiscountPct: 0,
        };
      })
    );
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
