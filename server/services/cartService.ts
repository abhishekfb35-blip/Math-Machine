import type { IStorage } from "../storage";
import type { CartItem, Product } from "@shared/types";
import { calculateDiscount, defaultOfferTiers, defaultDeliveryTiers, type PricingResult, type OfferTier, type DeliveryTier } from "./discountService";

export interface EnrichedCartItem extends CartItem {
  product: Product | undefined;
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
}

export class CartService {
  constructor(private storage: IStorage) {}

  async getCartDetails(sessionId: string): Promise<CartDetails> {
    const cart = await this.storage.getOrCreateCart(sessionId);
    const items = await this.storage.getCartItems(cart.id);
    const enrichedItems = await this.enrichItemsWithProducts(items);

    const offerTiers = await this.loadOfferTiers();
    const deliveryTiers = await this.loadDeliveryTiers();
    const pricing = this.calculateCartPricing(enrichedItems, offerTiers, deliveryTiers);

    return {
      id: cart.id,
      items: enrichedItems,
      itemCount: enrichedItems.reduce((sum, i) => sum + i.quantity, 0),
      ...pricing,
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

  private async loadOfferTiers(): Promise<OfferTier[]> {
    try {
      const config = await this.storage.getSiteConfig("offer-tiers");
      if (config) {
        const parsed = JSON.parse(config.value);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultOfferTiers;
  }

  private async loadDeliveryTiers(): Promise<DeliveryTier[]> {
    try {
      const config = await this.storage.getSiteConfig("delivery-tiers");
      if (config) {
        const parsed = JSON.parse(config.value);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultDeliveryTiers;
  }

  private async enrichItemsWithProducts(items: CartItem[]): Promise<EnrichedCartItem[]> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.storage.getProductById(item.productId);
        return { ...item, product };
      })
    );
  }

  private calculateCartPricing(items: EnrichedCartItem[], offerTiers: OfferTier[], deliveryTiers: DeliveryTier[]): PricingResult {
    const priceItems = items
      .filter(i => i.product)
      .map(i => ({ price: i.product!.price, quantity: i.quantity }));
    return calculateDiscount(priceItems, offerTiers, deliveryTiers);
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
