import { Resend } from "resend";

export interface OrderItemDetail {
  productName: string;
  productPrice: number;
  quantity: number;
  personalizationName: string | null;
  isFree: boolean | null;
}

export interface OrderNotification {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  itemCount: number;
  subtotal?: number;
  discount?: number;
  items?: OrderItemDetail[];
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  paymentStatus?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  error?: string;
}

export interface INotificationService {
  readonly name: string;
  sendOrderConfirmation(notification: OrderNotification): Promise<NotificationResult>;
  sendOrderStatusUpdate(orderId: string, status: string, customerEmail: string): Promise<NotificationResult>;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function aggregateItems(items: OrderItemDetail[]): OrderItemDetail[] {
  const map = new Map<string, OrderItemDetail>();
  for (const item of items) {
    const key = `${item.productName}|${item.personalizationName || ""}|${item.isFree}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

function buildOrderItemsHtml(items: OrderItemDetail[]): string {
  const aggregated = aggregateItems(items);
  return aggregated.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 500; color: #1a1a1a;">${item.productName}</div>
        ${item.personalizationName ? `<div style="font-size: 13px; color: #666; margin-top: 2px;">Personalisation: <strong>${item.personalizationName}</strong></div>` : ""}
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: center; color: #666;">${item.quantity}</td>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; white-space: nowrap;">
        ${item.isFree
          ? `<span style="text-decoration: line-through; color: #999;">${formatCurrency(item.productPrice)}</span> <span style="color: #16a34a; font-weight: 600;">FREE</span>`
          : `<span style="font-weight: 500; color: #1a1a1a;">${formatCurrency(item.productPrice)}</span>`
        }
      </td>
    </tr>
  `).join("");
}

function buildCustomerEmailHtml(n: OrderNotification): string {
  const itemsHtml = n.items ? buildOrderItemsHtml(n.items) : "";
  const hasDiscount = (n.discount || 0) > 0;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a1a1a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">TurtleLittle</h1>
      <p style="color: #cccccc; margin: 8px 0 0; font-size: 13px;">Personalised Luxury Towels & Blankets</p>
    </div>

    <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 22px;">Thank You for Your Order!</h2>
        <p style="color: #666; margin: 0; font-size: 14px;">Hi ${n.customerName}, your order has been confirmed.</p>
      </div>

      <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #666; padding: 4px 0;">Order ID</td>
            <td style="text-align: right; font-weight: 600; color: #1a1a1a;">#${n.orderId.slice(-8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="color: #666; padding: 4px 0;">Payment</td>
            <td style="text-align: right; font-weight: 500; color: #1a1a1a;">${n.paymentStatus === "cod" ? "Cash on Delivery" : "Paid"}</td>
          </tr>
        </table>
      </div>

      ${n.items && n.items.length > 0 ? `
      <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 12px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px;">Order Items</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 0; color: #999; font-weight: 500; font-size: 12px; text-transform: uppercase;">Item</th>
            <th style="text-align: center; padding: 8px 0; color: #999; font-weight: 500; font-size: 12px; text-transform: uppercase;">Qty</th>
            <th style="text-align: right; padding: 8px 0; color: #999; font-weight: 500; font-size: 12px; text-transform: uppercase;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      ` : ""}

      <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${n.subtotal ? `
          <tr>
            <td style="color: #666; padding: 4px 0;">Subtotal</td>
            <td style="text-align: right; color: #1a1a1a;">${formatCurrency(n.subtotal)}</td>
          </tr>
          ` : ""}
          ${hasDiscount ? `
          <tr>
            <td style="color: #16a34a; padding: 4px 0;">Buy 2 Get 1 Free Discount</td>
            <td style="text-align: right; color: #16a34a; font-weight: 500;">-${formatCurrency(n.discount!)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="color: #666; padding: 4px 0;">Shipping</td>
            <td style="text-align: right; color: #16a34a; font-weight: 500;">FREE</td>
          </tr>
          <tr style="border-top: 2px solid #e0e0e0;">
            <td style="padding: 12px 0 4px; font-weight: 700; font-size: 16px; color: #1a1a1a;">Total</td>
            <td style="padding: 12px 0 4px; text-align: right; font-weight: 700; font-size: 16px; color: #1a1a1a;">${formatCurrency(n.total)}</td>
          </tr>
        </table>
      </div>

      ${n.shippingAddress ? `
      <div style="margin-top: 24px;">
        <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 8px;">Shipping Address</h3>
        <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
          ${n.customerName}<br>
          ${n.shippingAddress}<br>
          ${n.shippingCity}, ${n.shippingState} - ${n.shippingPincode}<br>
          Phone: ${n.customerPhone}
        </p>
      </div>
      ` : ""}

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0; text-align: center;">
        <p style="color: #666; font-size: 13px; margin: 0 0 4px;">Your order will be prepared and dispatched within 3-5 business days.</p>
        <p style="color: #666; font-size: 13px; margin: 0;">We'll send you tracking details once shipped.</p>
      </div>

      <div style="margin-top: 24px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          Need help? WhatsApp us at <a href="https://wa.me/919990079722" style="color: #1a1a1a;">+91 99900 79722</a><br>
          or email <a href="mailto:hello@turtlelittle.com" style="color: #1a1a1a;">hello@turtlelittle.com</a>
        </p>
      </div>
    </div>

    <div style="text-align: center; padding: 16px;">
      <p style="color: #999; font-size: 11px; margin: 0;">&copy; ${new Date().getFullYear()} TurtleLittle. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildAdminEmailHtml(n: OrderNotification): string {
  const aggregated = n.items ? aggregateItems(n.items) : [];
  const itemsHtml = aggregated.length > 0 ? aggregated.map(item => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">
        ${item.productName}
        ${item.personalizationName ? `<br><span style="color: #666; font-size: 12px;">Name: ${item.personalizationName}</span>` : ""}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 14px;">${item.quantity}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 14px;">
        ${item.isFree ? "FREE" : formatCurrency(item.productPrice)}
      </td>
    </tr>
  `).join("") : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
    <div style="background: #dc2626; padding: 16px 24px;">
      <h1 style="color: #fff; margin: 0; font-size: 18px;">New Order Received</h1>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
        <tr>
          <td style="padding: 6px 0; color: #666; width: 140px;">Order ID</td>
          <td style="padding: 6px 0; font-weight: 600;">#${n.orderId.slice(-8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Customer</td>
          <td style="padding: 6px 0; font-weight: 500;">${n.customerName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Email</td>
          <td style="padding: 6px 0;"><a href="mailto:${n.customerEmail}" style="color: #1a1a1a;">${n.customerEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Phone</td>
          <td style="padding: 6px 0;"><a href="tel:${n.customerPhone}" style="color: #1a1a1a;">${n.customerPhone}</a></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Payment</td>
          <td style="padding: 6px 0; font-weight: 500;">${n.paymentStatus === "cod" ? "Cash on Delivery" : "Paid"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Total</td>
          <td style="padding: 6px 0; font-weight: 700; font-size: 16px; color: #dc2626;">${formatCurrency(n.total)}</td>
        </tr>
      </table>

      ${n.shippingAddress ? `
      <div style="background: #f9f9f9; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
        <strong style="font-size: 13px; color: #666; text-transform: uppercase;">Ship To</strong>
        <p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5;">
          ${n.customerName}<br>${n.shippingAddress}<br>${n.shippingCity}, ${n.shippingState} - ${n.shippingPincode}
        </p>
      </div>
      ` : ""}

      ${n.items && n.items.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #f9f9f9;">
            <th style="text-align: left; padding: 8px 12px; font-size: 12px; color: #666; text-transform: uppercase;">Item</th>
            <th style="text-align: center; padding: 8px 12px; font-size: 12px; color: #666; text-transform: uppercase;">Qty</th>
            <th style="text-align: right; padding: 8px 12px; font-size: 12px; color: #666; text-transform: uppercase;">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      ` : `<p style="font-size: 14px; color: #666;">${n.itemCount} item(s)</p>`}

      <div style="margin-top: 16px; padding-top: 12px; border-top: 2px solid #e0e0e0;">
        <table style="width: 100%; font-size: 14px;">
          ${n.subtotal ? `<tr><td style="color: #666; padding: 4px 0;">Subtotal</td><td style="text-align: right;">${formatCurrency(n.subtotal)}</td></tr>` : ""}
          ${(n.discount || 0) > 0 ? `<tr><td style="color: #16a34a; padding: 4px 0;">Discount</td><td style="text-align: right; color: #16a34a;">-${formatCurrency(n.discount!)}</td></tr>` : ""}
          <tr><td style="font-weight: 700; padding: 8px 0 0; font-size: 16px;">Total</td><td style="text-align: right; font-weight: 700; font-size: 16px; color: #dc2626;">${formatCurrency(n.total)}</td></tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export class ConsoleNotificationService implements INotificationService {
  readonly name = "console";

  async sendOrderConfirmation(notification: OrderNotification): Promise<NotificationResult> {
    console.log(
      `[Order Confirmation] Order #${notification.orderId} for ${notification.customerName} ` +
      `(${notification.customerEmail}) — ${notification.itemCount} items, total ₹${notification.total}`
    );
    return { success: true, channel: "console" };
  }

  async sendOrderStatusUpdate(orderId: string, status: string, customerEmail: string): Promise<NotificationResult> {
    console.log(`[Order Update] Order #${orderId} → ${status} (${customerEmail})`);
    return { success: true, channel: "console" };
  }
}

export class ResendNotificationService implements INotificationService {
  readonly name = "resend";
  private resend: Resend;
  private fromEmail: string;
  private adminEmail: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.EMAIL_FROM || "TurtleLittle <orders@turtlelittle.com>";
    this.adminEmail = process.env.ADMIN_EMAIL || "hello@turtlelittle.com";
  }

  async sendOrderConfirmation(notification: OrderNotification): Promise<NotificationResult> {
    try {
      const [customerResult, adminResult] = await Promise.allSettled([
        this.resend.emails.send({
          from: this.fromEmail,
          to: notification.customerEmail,
          subject: `Order Confirmed — #${notification.orderId.slice(-8).toUpperCase()} | TurtleLittle`,
          html: buildCustomerEmailHtml(notification),
        }),
        this.resend.emails.send({
          from: this.fromEmail,
          to: this.adminEmail,
          subject: `New Order #${notification.orderId.slice(-8).toUpperCase()} — ${formatCurrency(notification.total)} from ${notification.customerName}`,
          html: buildAdminEmailHtml(notification),
        }),
      ]);

      const customerOk = customerResult.status === "fulfilled";
      const adminOk = adminResult.status === "fulfilled";

      if (!customerOk) console.error("Failed to send customer email:", (customerResult as PromiseRejectedResult).reason);
      if (!adminOk) console.error("Failed to send admin email:", (adminResult as PromiseRejectedResult).reason);

      return {
        success: customerOk,
        channel: "resend",
        error: !customerOk ? `Customer email failed: ${(customerResult as PromiseRejectedResult).reason}` : undefined,
      };
    } catch (err) {
      console.error("Resend notification error:", err);
      return { success: false, channel: "resend", error: String(err) };
    }
  }

  async sendOrderStatusUpdate(orderId: string, status: string, customerEmail: string): Promise<NotificationResult> {
    try {
      const statusMessages: Record<string, string> = {
        shipped: "Your order has been shipped! You'll receive tracking details shortly.",
        delivered: "Your order has been delivered! We hope you love your personalised TurtleLittle products.",
        cancelled: "Your order has been cancelled. If payment was made, a refund will be processed within 7-10 business days.",
      };

      const message = statusMessages[status] || `Your order status has been updated to: ${status}`;

      await this.resend.emails.send({
        from: this.fromEmail,
        to: customerEmail,
        subject: `Order Update — #${orderId.slice(-8).toUpperCase()} | TurtleLittle`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a1a1a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">TurtleLittle</h1>
    </div>
    <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; text-align: center;">
      <h2 style="color: #1a1a1a; margin: 0 0 8px;">Order Update</h2>
      <p style="color: #666; font-size: 14px;">Order #${orderId.slice(-8).toUpperCase()}</p>
      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="font-size: 14px; color: #1a1a1a; margin: 0; line-height: 1.6;">${message}</p>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        Questions? WhatsApp us at <a href="https://wa.me/919990079722" style="color: #1a1a1a;">+91 99900 79722</a>
      </p>
    </div>
  </div>
</body>
</html>`,
      });

      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend status update error:", err);
      return { success: false, channel: "resend", error: String(err) };
    }
  }
}

export function createNotificationService(): INotificationService {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey && resendKey.length > 0) {
    console.log("Using Resend email notification service");
    return new ResendNotificationService();
  }

  const provider = process.env.NOTIFICATION_PROVIDER || "console";
  switch (provider) {
    case "console":
      return new ConsoleNotificationService();
    default:
      console.warn(`Unknown notification provider "${provider}", falling back to console`);
      return new ConsoleNotificationService();
  }
}

export const notificationService = createNotificationService();
