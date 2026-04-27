import type { IStorage } from "../storage";
import type { Order } from "@shared/types";
import type { IPaymentProvider } from "../providers/payment";
import type { INotificationService, OrderItemDetail } from "../providers/notification";
import type { CartDetails, EnrichedCartItem } from "./cartService";

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

  /**
   * COD checkout. Receives pre-computed CartDetails from CartService —
   * no pricing recalculation here.
   */
  async checkout(cartDetails: CartDetails, input: CheckoutInput): Promise<CheckoutResult> {
    if (cartDetails.items.length === 0) {
      throw new EmptyCartError("Cart is empty");
    }

    const couponDiscount = input.couponDiscount || 0;
    const finalTotal = Math.max(0, cartDetails.total - couponDiscount);
    const totalDiscount = cartDetails.discount + couponDiscount;

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
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      shippingFee: cartDetails.shippingFee,
      total: finalTotal,
      status: payment.status === "cod" ? "confirmed" : "pending",
      paymentStatus: payment.status,
      notes: input.notes || null,
      paymentId: payment.paymentId,
      currency: input.currency || "INR",
    });

    const orderItemDetails = await this.createOrderItems(order.id, cartDetails);
    await this.storage.clearCart(cartDetails.id);

    this.notificationService.sendOrderConfirmation({
      orderId: order.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      total: finalTotal,
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      itemCount: cartDetails.itemCount,
      items: orderItemDetails,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      paymentStatus: payment.status,
    }).catch(err => console.error("Notification error:", err));

    return {
      orderId: order.id,
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      shippingFee: cartDetails.shippingFee,
      couponDiscount,
      total: finalTotal,
    };
  }

  /**
   * Razorpay checkout. Receives pre-computed CartDetails from CartService —
   * no pricing recalculation here.
   */
  async checkoutWithPayment(cartDetails: CartDetails, input: PaidCheckoutInput): Promise<CheckoutResult> {
    if (cartDetails.items.length === 0) {
      throw new EmptyCartError("Cart is empty");
    }

    const couponDiscount = input.couponDiscount || 0;
    const finalTotal = Math.max(0, cartDetails.total - couponDiscount);
    const totalDiscount = cartDetails.discount + couponDiscount;

    const order = await this.storage.createOrder({
      customerId: input.customerId || null,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      shippingFee: cartDetails.shippingFee,
      total: finalTotal,
      status: "confirmed",
      paymentStatus: "paid",
      notes: input.notes || null,
      paymentId: input.paymentId,
      razorpayOrderId: input.razorpayOrderId,
      currency: input.currency || "INR",
    });

    const orderItemDetails = await this.createOrderItems(order.id, cartDetails);
    await this.storage.clearCart(cartDetails.id);

    this.notificationService.sendOrderConfirmation({
      orderId: order.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      total: finalTotal,
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      itemCount: cartDetails.itemCount,
      items: orderItemDetails,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingState: input.shippingState,
      shippingPincode: input.shippingPincode,
      paymentStatus: "paid",
    }).catch(err => console.error("Notification error:", err));

    return {
      orderId: order.id,
      subtotal: cartDetails.subtotal,
      discount: totalDiscount,
      shippingFee: cartDetails.shippingFee,
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

  /**
   * Expands cart items by quantity, sorts by effectivePrice desc (cheapest get free),
   * and saves one order_items row per unit. Uses CartDetails.freeIndices.length to
   * determine the number of free items — same value that CartService calculated for
   * the discount — so there is no separate computeNumFree call here.
   */
  private async createOrderItems(
    orderId: string,
    cartDetails: CartDetails,
  ): Promise<OrderItemDetail[]> {
    const expanded: { item: EnrichedCartItem; effectivePrice: number }[] = [];
    for (const item of cartDetails.items) {
      for (let i = 0; i < item.quantity; i++) {
        expanded.push({ item, effectivePrice: item.effectivePrice });
      }
    }
    expanded.sort((a, b) => b.effectivePrice - a.effectivePrice);

    const totalCount = expanded.length;
    const numFree = cartDetails.freeIndices.length;
    const details: OrderItemDetail[] = [];

    for (let i = 0; i < expanded.length; i++) {
      const { item, effectivePrice } = expanded[i];
      if (!item.product) continue;
      const isFree = i >= totalCount - numFree;
      await this.storage.createOrderItem({
        orderId,
        productId: item.product.id,
        productName: item.product.name,
        productPrice: effectivePrice,
        quantity: 1,
        personalizationName: item.personalizationName,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        isFree,
      });
      details.push({
        productName: item.product.name,
        productPrice: effectivePrice,
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
