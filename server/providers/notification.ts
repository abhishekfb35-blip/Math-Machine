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
  sendOtpEmail(email: string, otp: string): Promise<NotificationResult>;
  sendWelcomeCoupon(email: string, firstName: string, discountCode: string, discountPercent: number): Promise<NotificationResult>;
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

  async sendOtpEmail(email: string, otp: string): Promise<NotificationResult> {
    console.log(`[OTP] Code ${otp} sent to ${email}`);
    return { success: true, channel: "console" };
  }

  async sendWelcomeCoupon(email: string, firstName: string, discountCode: string, discountPercent: number): Promise<NotificationResult> {
    console.log(`[Welcome Coupon] ${discountCode} (${discountPercent}% off) sent to ${firstName} <${email}>`);
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

  async sendOtpEmail(email: string, otp: string): Promise<NotificationResult> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `${otp} is your TurtleLittle verification code`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a1a1a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">TurtleLittle</h1>
      <p style="color: #cccccc; margin: 8px 0 0; font-size: 13px;">Personalised Luxury Towels & Blankets</p>
    </div>
    <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; text-align: center;">
      <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 22px;">Your Verification Code</h2>
      <p style="color: #666; font-size: 14px; margin: 0 0 24px;">Enter this code to sign in to your account.</p>
      <div style="background: #f9f9f9; border-radius: 12px; padding: 24px; display: inline-block;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
      </div>
      <p style="color: #999; font-size: 13px; margin-top: 24px;">This code expires in 10 minutes.</p>
      <p style="color: #999; font-size: 12px; margin-top: 16px;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend OTP error:", err);
      return { success: false, channel: "resend", error: String(err) };
    }
  }

  async sendWelcomeCoupon(email: string, firstName: string, discountCode: string, discountPercent: number): Promise<NotificationResult> {
    try {
      const displayName = firstName && firstName !== "." ? firstName : "there";
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `Welcome to TurtleLittle! Here's Your ${discountPercent}% Discount 🎉`,
        html: `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
<p style="text-align:center;margin:0 0 10px"><img src="data:image/png;base64,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" alt="TurtleLittle" height="40" style="height:40px"></p>
<p style="text-align:center;font-size:18px;font-weight:700;margin:0 0 4px">Welcome, ${displayName}! 🎉</p>
<p style="text-align:center;font-size:13px;color:#666;margin:0 0 14px">We're so happy to have you in the TurtleLittle family.</p>
<div style="background:#1a1a1a;border-radius:8px;padding:16px;text-align:center;margin:0 0 14px">
<p style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Your Discount Code</p>
<p style="color:#fff;font-size:22px;font-weight:700;letter-spacing:2px;margin:0 0 4px;font-family:monospace">${discountCode}</p>
<p style="color:#e0c97f;font-size:13px;font-weight:600;margin:0">${discountPercent}% OFF your next order</p>
</div>
<p style="text-align:center;margin:0 0 10px"><a href="https://turtlelittle.com/shop" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-weight:600;font-size:13px;display:inline-block">Shop Now</a></p>
<p style="text-align:center;font-size:11px;color:#999;margin:0">Enter code at checkout. One-time use. Questions? <a href="https://wa.me/919990079722" style="color:#333">WhatsApp us</a></p>
</div>`,
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend welcome coupon error:", err);
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
