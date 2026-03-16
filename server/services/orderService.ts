import type { IStorage } from "../storage";
import type { Order } from "@shared/types";
import type { IPaymentProvider } from "../providers/payment";
import type { INotificationService, OrderItemDetail } from "../providers/notification";
import { calculateDiscount } from "./discountService";

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
  couponDiscount: number;
  total: number;
}

export class OrderService {
  constructor(
    private storage: IStorage,
    private paymentProvider: IPaymentProvider,
    private notificationService: INotificationService,
  ) {}

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

    const pricing = calculateDiscount(priceItems);

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
      total: finalTotal,
      status: payment.status === "cod" ? "confirmed" : "pending",
      paymentStatus: payment.status,
      notes: input.notes || null,
      paymentId: payment.paymentId,
    });

    const orderItemDetails = await this.createOrderItems(order.id, itemsWithProducts);
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

    const pricing = calculateDiscount(priceItems);

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
      total: finalTotal,
      status: "confirmed",
      paymentStatus: "paid",
      notes: input.notes || null,
      paymentId: input.paymentId,
      razorpayOrderId: input.razorpayOrderId,
    });

    const orderItemDetails = await this.createOrderItems(order.id, itemsWithProducts);
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
    itemsWithProducts: { quantity: number; personalizationName: string | null; selectedColor?: string | null; selectedSize?: string | null; product: any }[]
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
    const numFree = totalCount >= 3 ? Math.floor(totalCount / 2) : 0;
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
