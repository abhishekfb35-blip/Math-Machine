export interface PaymentResult {
  success: boolean;
  paymentId: string | null;
  status: "pending" | "paid" | "failed" | "cod";
  error?: string;
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
  verifyPayment(paymentId: string, signature?: string): Promise<PaymentResult>;
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

export function createPaymentProvider(): IPaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || "cod";

  switch (provider) {
    case "cod":
      return new CodPaymentProvider();
    default:
      console.warn(`Unknown payment provider "${provider}", falling back to COD`);
      return new CodPaymentProvider();
  }
}

export const paymentProvider = createPaymentProvider();
