import type { IStorage } from "../storage";
import type { CartItem, Product } from "@shared/types";
import { calculateDiscount, type PricingResult } from "./discountService";

export interface EnrichedCartItem extends CartItem {
  product: Product | undefined;
}

export interface CartDetails {
  id: number;
  items: EnrichedCartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  freeIndices: number[];
}

export class CartService {
  constructor(private storage: IStorage) {}

  async getCartDetails(sessionId: string): Promise<CartDetails> {
    const cart = await this.storage.getOrCreateCart(sessionId);
    const items = await this.storage.getCartItems(cart.id);
    const enrichedItems = await this.enrichItemsWithProducts(items);
    const pricing = this.calculateCartPricing(enrichedItems);

    return {
      id: cart.id,
      items: enrichedItems,
      itemCount: enrichedItems.reduce((sum, i) => sum + i.quantity, 0),
      ...pricing,
    };
  }

  async addItem(sessionId: string, productId: number, quantity: number, personalizationName: string | null): Promise<{ item: CartItem; isNew: boolean }> {
    const product = await this.storage.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const cart = await this.storage.getOrCreateCart(sessionId);
    const existingItems = await this.storage.getCartItems(cart.id);
    const existing = existingItems.find(
      i => i.productId === productId && i.personalizationName === (personalizationName || null)
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
    });

    return { item, isNew: true };
  }

  async updateItem(itemId: number, quantity: number, personalizationName?: string): Promise<{ deleted: true } | CartItem> {
    if (quantity === 0) {
      await this.storage.removeCartItem(itemId);
      return { deleted: true };
    }
    const updated = await this.storage.updateCartItem(itemId, quantity, personalizationName);
    if (!updated) {
      throw new NotFoundError("Item not found");
    }
    return updated;
  }

  async removeItem(itemId: number): Promise<void> {
    await this.storage.removeCartItem(itemId);
  }

  private async enrichItemsWithProducts(items: CartItem[]): Promise<EnrichedCartItem[]> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.storage.getProductById(item.productId);
        return { ...item, product };
      })
    );
  }

  private calculateCartPricing(items: EnrichedCartItem[]): PricingResult {
    const priceItems = items
      .filter(i => i.product)
      .map(i => ({ price: i.product!.price, quantity: i.quantity }));
    return calculateDiscount(priceItems);
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
