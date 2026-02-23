import Razorpay from "razorpay";
import crypto from "crypto";

export interface PaymentResult {
  success: boolean;
  paymentId: string | null;
  status: "pending" | "paid" | "failed" | "cod";
  error?: string;
  razorpayOrderId?: string;
}

export interface PaymentOrderOptions {
  orderId: string;
  amount: number;
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface IPaymentProvider {
  readonly name: string;
  createPaymentOrder(options: PaymentOrderOptions): Promise<PaymentResult>;
  verifyPayment(paymentId: string, signature?: string, orderId?: string): Promise<PaymentResult>;
}

export class CodPaymentProvider implements IPaymentProvider {
  readonly name = "cod";

  async createPaymentOrder(options: PaymentOrderOptions): Promise<PaymentResult> {
    return {
      success: true,
      paymentId: null,
      status: "cod",
    };
  }

  async verifyPayment(_paymentId: string): Promise<PaymentResult> {
    return {
      success: true,
      paymentId: null,
      status: "cod",
    };
  }
}

export class RazorpayPaymentProvider implements IPaymentProvider {
  readonly name = "razorpay";
  private razorpay: InstanceType<typeof Razorpay>;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
    }
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createPaymentOrder(options: PaymentOrderOptions): Promise<PaymentResult> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(options.amount * 100),
        currency: options.currency || "INR",
        receipt: options.orderId || `receipt_${Date.now()}`,
        notes: {
          customerName: options.customerName,
          customerEmail: options.customerEmail,
          customerPhone: options.customerPhone,
        },
      });

      return {
        success: true,
        paymentId: null,
        status: "pending",
        razorpayOrderId: order.id,
      };
    } catch (err: any) {
      console.error("Razorpay create order error:", err);
      return {
        success: false,
        paymentId: null,
        status: "failed",
        error: err.message || "Failed to create payment order",
      };
    }
  }

  async verifyPayment(paymentId: string, signature?: string, orderId?: string): Promise<PaymentResult> {
    try {
      if (!signature || !orderId) {
        return { success: false, paymentId, status: "failed", error: "Missing signature or order ID" };
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET!;
      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== signature) {
        return { success: false, paymentId, status: "failed", error: "Invalid payment signature" };
      }

      return {
        success: true,
        paymentId,
        status: "paid",
      };
    } catch (err: any) {
      console.error("Razorpay verify payment error:", err);
      return { success: false, paymentId, status: "failed", error: err.message };
    }
  }
}

let razorpayProvider: RazorpayPaymentProvider | null = null;

export function getRazorpayProvider(): RazorpayPaymentProvider | null {
  if (!razorpayProvider) {
    try {
      razorpayProvider = new RazorpayPaymentProvider();
    } catch {
      console.warn("Razorpay not configured (missing keys), online payment unavailable");
      return null;
    }
  }
  return razorpayProvider;
}

export const codProvider = new CodPaymentProvider();
export const paymentProvider = codProvider;
