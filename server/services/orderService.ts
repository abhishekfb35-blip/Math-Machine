import type { IStorage } from "../storage";
import type { Order } from "@shared/types";
import type { IPaymentProvider } from "../providers/payment";
import type { INotificationService, OrderItemDetail } from "../providers/notification";
import { calculateDiscount, computeNumFree, defaultOfferTiers, defaultDeliveryTiers, type OfferTier, type DeliveryTier } from "./discountService";

export interface CheckoutInput {
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  notes?: string | null;
  discountCode?: string | null;
  couponDiscount?: number;
  currency?: string | null;
}

export interface PaidCheckoutInput extends CheckoutInput {
  paymentId: string;
  razorpayOrderId: string;
  paymentStatus: "paid";
}

export interface CheckoutResult {
  orderId: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  couponDiscount: number;
  total: number;
}

export class OrderService {
  constructor(
    private storage: IStorage,
    private paymentProvider: IPaymentProvider,
    private notificationService: INotificationService,
  ) {}

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

  async checkout(sessionId: string, input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.storage.getOrCreateCart(sessionId);
    const items = await this.storage.getCartItems(cart.id);

    if (items.length === 0) {
      throw new EmptyCartError("Cart is empty");
    }

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.storage.getProductById(item.productId);
        return { ...item, product };
      })
    );

    const priceItems = itemsWithProducts
      .filter(i => i.product)
      .map(i => ({ price: i.product!.price, quantity: i.quantity }));

    const offerTiers = await this.loadOfferTiers();
    const deliveryTiers = await this.loadDeliveryTiers();
    const isDomestic = !input.currency || input.currency.toUpperCase() === "INR";
    const pricing = calculateDiscount(priceItems, offerTiers, deliveryTiers, isDomestic);

    const couponDiscount = input.couponDiscount || 0;
    const finalTotal = Math.max(0, pricing.total - couponDiscount);
    const totalDiscount = pricing.discount + couponDiscount;

    const payment = await this.paymentProvider.createPaymentOrder({
      orderId: "",
      amount: finalTotal,
      currency: "INR",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    });

    const order = await this.storage.createOrder({
      customerId: input.customerId || null,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      shippingFee: pricing.shippingFee,
      total: finalTotal,
      status: payment.status === "cod" ? "confirmed" : "pending",
      paymentStatus: payment.status,
      notes: input.notes || null,
      paymentId: payment.paymentId,
      currency: input.currency || "INR",
    });

    const orderItemDetails = await this.createOrderItems(order.id, itemsWithProducts, offerTiers);
    await this.storage.clearCart(cart.id);

    this.notificationService.sendOrderConfirmation({
      orderId: order.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      total: finalTotal,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      itemCount: itemsWithProducts.reduce((sum, i) => sum + i.quantity, 0),
      items: orderItemDetails,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      paymentStatus: payment.status,
    }).catch(err => console.error("Notification error:", err));

    return {
      orderId: order.id,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      shippingFee: pricing.shippingFee,
      couponDiscount,
      total: finalTotal,
    };
  }

  async checkoutWithPayment(sessionId: string, input: PaidCheckoutInput): Promise<CheckoutResult> {
    const cart = await this.storage.getOrCreateCart(sessionId);
    const items = await this.storage.getCartItems(cart.id);

    if (items.length === 0) {
      throw new EmptyCartError("Cart is empty");
    }

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.storage.getProductById(item.productId);
        return { ...item, product };
      })
    );

    const priceItems = itemsWithProducts
      .filter(i => i.product)
      .map(i => ({ price: i.product!.price, quantity: i.quantity }));

    const offerTiers = await this.loadOfferTiers();
    const deliveryTiers = await this.loadDeliveryTiers();
    const isDomestic = !input.currency || input.currency.toUpperCase() === "INR";
    const pricing = calculateDiscount(priceItems, offerTiers, deliveryTiers, isDomestic);

    const couponDiscount = input.couponDiscount || 0;
    const finalTotal = Math.max(0, pricing.total - couponDiscount);
    const totalDiscount = pricing.discount + couponDiscount;

    const order = await this.storage.createOrder({
      customerId: input.customerId || null,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      shippingFee: pricing.shippingFee,
      total: finalTotal,
      status: "confirmed",
      paymentStatus: "paid",
      notes: input.notes || null,
      paymentId: input.paymentId,
      razorpayOrderId: input.razorpayOrderId,
      currency: input.currency || "INR",
    });

    const orderItemDetails = await this.createOrderItems(order.id, itemsWithProducts, offerTiers);
    await this.storage.clearCart(cart.id);

    this.notificationService.sendOrderConfirmation({
      orderId: order.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      total: finalTotal,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      itemCount: itemsWithProducts.reduce((sum, i) => sum + i.quantity, 0),
      items: orderItemDetails,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      paymentStatus: "paid",
    }).catch(err => console.error("Notification error:", err));

    return {
      orderId: order.id,
      subtotal: pricing.subtotal,
      discount: totalDiscount,
      shippingFee: pricing.shippingFee,
      couponDiscount,
      total: finalTotal,
    };
  }

  async getOrder(orderId: string): Promise<(Order & { items: any[] }) | null> {
    const order = await this.storage.getOrderById(orderId);
    if (!order) return null;
    const items = await this.storage.getOrderItems(orderId);
    return { ...order, items };
  }

  private async createOrderItems(
    orderId: string,
    itemsWithProducts: { quantity: number; personalizationName: string | null; selectedColor?: string | null; selectedSize?: string | null; product: any }[],
    offerTiers: OfferTier[],
  ): Promise<OrderItemDetail[]> {
    const expanded: { product: any; personalizationName: string | null; selectedColor: string | null; selectedSize: string | null }[] = [];
    itemsWithProducts.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        expanded.push({
          product: item.product,
          personalizationName: item.personalizationName,
          selectedColor: item.selectedColor || null,
          selectedSize: item.selectedSize || null,
        });
      }
    });
    expanded.sort((a, b) => (b.product?.price || 0) - (a.product?.price || 0));

    const totalCount = expanded.length;
    const numFree = computeNumFree(totalCount, offerTiers);
    const details: OrderItemDetail[] = [];

    for (let i = 0; i < expanded.length; i++) {
      const item = expanded[i];
      if (!item.product) continue;
      const isFree = i >= totalCount - numFree;
      await this.storage.createOrderItem({
        orderId,
        productId: item.product.id,
        productName: item.product.name,
        productPrice: item.product.price,
        quantity: 1,
        personalizationName: item.personalizationName,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        isFree,
      });
      details.push({
        productName: item.product.name,
        productPrice: item.product.price,
        quantity: 1,
        personalizationName: item.personalizationName,
        isFree,
      });
    }
    return details;
  }
}

export class EmptyCartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyCartError";
  }
}
