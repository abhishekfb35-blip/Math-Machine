import { Resend } from "resend";
import { storage } from "../storage";

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

export interface AbandonedCartItem {
  productName: string;
  personalizationName: string | null;
  quantity: number;
  price: number;
}

export interface SecurityAlertPayload {
  toEmail: string;
  totalBlocks: number;
  windowMinutes: number;
  breakdown: Array<{ tier: string; cat: string; count: number }>;
  siteUrl?: string;
}

export interface ExchangeRateAlertPayload {
  toEmail: string;
  lastSuccessAt: string | null;
  staleHoursThreshold: number;
  lastError: string | null;
}

export interface INotificationService {
  readonly name: string;
  sendOrderConfirmation(notification: OrderNotification): Promise<NotificationResult>;
  sendOrderConfirmed(notification: OrderNotification): Promise<NotificationResult>;
  sendOrderStatusUpdate(orderId: string, status: string, customerEmail: string): Promise<NotificationResult>;
  sendOtpEmail(email: string, otp: string): Promise<NotificationResult>;
  sendWelcomeCoupon(email: string, firstName: string, discountCode: string, discountPercent: number): Promise<NotificationResult>;
  sendAbandonedCart(email: string, firstName: string, items: AbandonedCartItem[], cartUrl: string): Promise<NotificationResult>;
  sendSecurityAlert(payload: SecurityAlertPayload): Promise<NotificationResult>;
  sendExchangeRateAlert(payload: ExchangeRateAlertPayload): Promise<NotificationResult>;
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOrderConfirmedHtml(n: OrderNotification): string {
  const safeCustomerName = escapeHtml(n.customerName || "");
  const personalizedItems = (n.items || []).filter(item => item.personalizationName && item.personalizationName.trim());

  const selectionsHtml = personalizedItems.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom: 24px;">
      <tr>
        <td style="padding-bottom: 10px;">
          <p style="color: #1a1a1a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0; font-family: Arial, Helvetica, sans-serif;">Your Selections</p>
        </td>
      </tr>
      <tr>
        <td bgcolor="#f9f9f9" style="padding: 16px; border-radius: 8px;">
          ${personalizedItems.map((item, idx) => `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr>
              <td style="font-size: 14px; color: #1a1a1a; padding: ${idx === 0 ? "0" : "8px 0 0"}; ${idx < personalizedItems.length - 1 ? "padding-bottom: 8px; border-bottom: 1px solid #eeeeee;" : ""} font-family: Arial, Helvetica, sans-serif;">
                <strong style="color: #1a1a1a;">${escapeHtml(item.personalizationName || "")}</strong>
                <span style="color: #aaaaaa; padding: 0 5px;">&#8212;</span>
                <span style="color: #555555;">${escapeHtml(item.productName)}</span>
              </td>
            </tr>
          </table>`).join("")}
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px;">
          <p style="color: #666666; font-size: 14px; margin: 0; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">These are the kind of pieces that quietly become a part of everyday moments&#8212;used often, remembered for a long time.</p>
        </td>
      </tr>
    </table>` : "";

  const progressHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom: 28px;">
      <tr>
        <td colspan="7" style="padding-bottom: 14px;">
          <p style="color: #1a1a1a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0; font-family: Arial, Helvetica, sans-serif;">Progress</p>
        </td>
      </tr>
      <tr valign="middle">
        <td align="center" width="60" style="vertical-align: middle;">
          <div style="width: 12px; height: 12px; border-radius: 6px; background-color: #1a1a1a; margin: 0 auto;"></div>
        </td>
        <td style="vertical-align: middle;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td height="2" bgcolor="#1a1a1a" style="font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr></table>
        </td>
        <td align="center" width="60" style="vertical-align: middle;">
          <div style="width: 14px; height: 14px; border-radius: 7px; background-color: #b45309; margin: 0 auto;"></div>
        </td>
        <td style="vertical-align: middle;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td height="2" bgcolor="#e0e0e0" style="font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr></table>
        </td>
        <td align="center" width="60" style="vertical-align: middle;">
          <div style="width: 12px; height: 12px; border-radius: 6px; background-color: #e0e0e0; margin: 0 auto;"></div>
        </td>
        <td style="vertical-align: middle;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td height="2" bgcolor="#e0e0e0" style="font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td></tr></table>
        </td>
        <td align="center" width="60" style="vertical-align: middle;">
          <div style="width: 12px; height: 12px; border-radius: 6px; background-color: #e0e0e0; margin: 0 auto;"></div>
        </td>
      </tr>
      <tr>
        <td align="center" width="60" style="padding-top: 7px;"><span style="font-size: 10px; color: #555555; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">Confirmed</span></td>
        <td></td>
        <td align="center" width="60" style="padding-top: 7px;"><span style="font-size: 10px; color: #b45309; font-weight: 700; font-family: Arial, Helvetica, sans-serif;">In Craft</span></td>
        <td></td>
        <td align="center" width="60" style="padding-top: 7px;"><span style="font-size: 10px; color: #aaaaaa; font-family: Arial, Helvetica, sans-serif;">Finishing</span></td>
        <td></td>
        <td align="center" width="60" style="padding-top: 7px;"><span style="font-size: 10px; color: #aaaaaa; font-family: Arial, Helvetica, sans-serif;">Dispatched</span></td>
      </tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" role="presentation">
  <tr>
    <td align="center" style="padding: 20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width: 600px; width: 100%;">

        <!-- Header -->
        <tr>
          <td bgcolor="#1a1a1a" align="center" style="padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif; font-weight: 400;">TurtleLittle</h1>
            <p style="color: #cccccc; margin: 8px 0 0; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif;">Personalised Luxury Lifestyle Products</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td bgcolor="#ffffff" style="padding: 32px; border-radius: 0 0 12px 12px;">

            <p style="color: #666666; font-size: 14px; margin: 0 0 6px; font-family: Arial, Helvetica, sans-serif;">Hi ${safeCustomerName},</p>
            <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px; font-weight: 700; font-family: Georgia, 'Times New Roman', serif; line-height: 1.3;">We&#8217;ve begun crafting something personal for you.</h2>
            <p style="color: #666666; font-size: 14px; margin: 0 0 28px; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">Your order is confirmed, and each piece is now being carefully prepared.</p>

            ${selectionsHtml}

            ${progressHtml}

            <p style="color: #444444; font-size: 14px; line-height: 1.8; margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif;">Every TurtleLittle design is developed with a focus on the smallest details&#8212;because that&#8217;s what makes it feel special when you finally hold it.</p>
            <p style="color: #444444; font-size: 14px; line-height: 1.8; margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif;">Your name and design are carefully embroidered using precision machines, guided by skilled hands to ensure each stitch is clean, balanced, and lasting.</p>
            <p style="color: #444444; font-size: 14px; line-height: 1.8; margin: 0 0 28px; font-family: Arial, Helvetica, sans-serif;">We use threads and materials chosen not just for how they look, but for how they hold up&#8212;so your piece keeps its character over time.</p>

            <!-- What Happens Next -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom: 28px;">
              <tr>
                <td bgcolor="#f9f9f9" style="padding: 20px; border-radius: 8px;">
                  <p style="color: #1a1a1a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; font-family: Arial, Helvetica, sans-serif;">What Happens Next</p>
                  <p style="color: #666666; font-size: 14px; margin: 0; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">Once your pieces are ready, we&#8217;ll notify you as they move to dispatch.</p>
                </td>
              </tr>
            </table>

            <!-- Care tips -->
            <p style="color: #1a1a1a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; font-family: Arial, Helvetica, sans-serif;">Caring for Your Piece</p>
            <p style="color: #666666; font-size: 13px; margin: 0 0 6px; font-family: Arial, Helvetica, sans-serif;">A little care goes a long way:</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom: 28px;">
              ${["Wash gently with mild detergent", "Use cold or lukewarm water", "Avoid bleach", "Tumble dry on low, or dry in shade"].map(tip =>
                `<tr><td style="color: #555555; font-size: 14px; padding: 3px 0; font-family: Arial, Helvetica, sans-serif;">&#8211;&nbsp;${tip}</td></tr>`
              ).join("")}
            </table>

            <!-- Contact footer -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-top: 1px solid #f0f0f0;">
              <tr>
                <td style="padding-top: 24px;">
                  <p style="color: #666666; font-size: 13px; line-height: 1.7; margin: 0 0 14px; font-family: Arial, Helvetica, sans-serif;">Many of our customers also choose TurtleLittle pieces for return gifts and special occasions&#8212;we&#8217;d be glad to help if you&#8217;re considering something similar.</p>
                  <p style="color: #666666; font-size: 13px; margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif;">You can also reach out anytime if you&#8217;d like an update on your order.</p>
                  <p style="color: #1a1a1a; font-size: 13px; margin: 0; line-height: 2; font-family: Arial, Helvetica, sans-serif;">
                    <a href="https://wa.me/919990079722" style="color: #1a1a1a; text-decoration: none; font-weight: 600;">WhatsApp: +91 99900 79722</a><br>
                    <a href="mailto:hello@turtlelittle.com" style="color: #1a1a1a; text-decoration: none; font-weight: 600;">Email: hello@turtlelittle.com</a>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding: 16px;">
            <p style="color: #999999; font-size: 11px; margin: 0; font-family: Arial, Helvetica, sans-serif;">&copy; ${new Date().getFullYear()} TurtleLittle. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
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

  async sendOrderConfirmed(notification: OrderNotification): Promise<NotificationResult> {
    const names = (notification.items || [])
      .filter(i => i.personalizationName)
      .map(i => `${i.personalizationName} — ${i.productName}`)
      .join(", ");
    console.log(`[Order Confirmed] Order #${notification.orderId} for ${notification.customerName} — crafting: ${names || "no personalised items"}`);
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

  async sendAbandonedCart(email: string, firstName: string, items: AbandonedCartItem[], cartUrl: string): Promise<NotificationResult> {
    const summary = items.map(i => `${i.productName} x${i.quantity}${i.personalizationName ? ` (${i.personalizationName})` : ""}`).join(", ");
    console.log(`[Abandoned Cart] Reminder sent to ${firstName} <${email}> — ${summary} — ${cartUrl}`);
    return { success: true, channel: "console" };
  }

  async sendSecurityAlert(payload: SecurityAlertPayload): Promise<NotificationResult> {
    console.log(`[Security Alert] ${payload.totalBlocks} blocks in ${payload.windowMinutes}min — sending to ${payload.toEmail}`);
    return { success: true, channel: "console" };
  }

  async sendExchangeRateAlert(payload: ExchangeRateAlertPayload): Promise<NotificationResult> {
    console.log(`[Exchange Rate Alert] Rates stale >${payload.staleHoursThreshold}h — last success: ${payload.lastSuccessAt} — error: ${payload.lastError} — sending to ${payload.toEmail}`);
    return { success: true, channel: "console" };
  }
}

function buildAbandonedCartHtml(firstName: string, items: AbandonedCartItem[], cartUrl: string): string {
  const displayName = firstName && firstName !== "." ? firstName : "there";
  const itemsHtml = items.map(item => `
    <tr>
      <td width="65%" style="font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 10px 8px 10px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; max-width: 0;">
        ${item.productName}
        ${item.personalizationName ? `<br><span style="font-size: 12px; color: #666;">Name: <strong>${item.personalizationName}</strong></span>` : ""}
      </td>
      <td width="10%" style="font-family: Arial, sans-serif; font-size: 13px; color: #666; padding: 10px 4px; border-bottom: 1px solid #f0f0f0; text-align: center; vertical-align: top; white-space: nowrap;">${item.quantity}</td>
      <td width="25%" style="font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; font-weight: bold; padding: 10px 0 10px 4px; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top; white-space: nowrap;">${formatCurrency(item.price)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7">
  <tr><td align="center" style="padding: 20px 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

      <tr><td bgcolor="#1a1a1a" style="padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">TurtleLittle</p>
        <p style="margin: 8px 0 0; font-family: Arial, sans-serif; font-size: 13px; color: #cccccc;">Personalised Luxury Towels &amp; Blankets</p>
      </td></tr>

      <tr><td bgcolor="#ffffff" style="padding: 32px; border-radius: 0 0 12px 12px;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="text-align: center; padding-bottom: 24px;">
            <p style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 22px; font-weight: bold; color: #1a1a1a;">You left something behind!</p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #666;">Hi ${displayName}, your cart is waiting for you.</p>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-bottom: 2px solid #1a1a1a;">Item</td>
            <td style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-bottom: 2px solid #1a1a1a; text-align: center;">Qty</td>
            <td style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-bottom: 2px solid #1a1a1a; text-align: right;">Price</td>
          </tr>
          ${itemsHtml}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px;">
          <tr><td align="center">
            <a href="${cartUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 14px 36px; border-radius: 6px; letter-spacing: 0.5px;">Complete Your Order</a>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #f0f0f0;">
          <tr><td style="padding-top: 20px; text-align: center;">
            <p style="margin: 0 0 4px; font-family: Arial, sans-serif; font-size: 12px; color: #999;">Questions? <a href="https://wa.me/919990079722" style="color: #1a1a1a;">WhatsApp us</a> or email <a href="mailto:hello@turtlelittle.com" style="color: #1a1a1a;">hello@turtlelittle.com</a></p>
          </td></tr>
        </table>

      </td></tr>

      <tr><td style="text-align: center; padding: 16px;">
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #999;">&copy; ${new Date().getFullYear()} TurtleLittle. All rights reserved.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export class ResendNotificationService implements INotificationService {
  readonly name = "resend";
  private resend: Resend;
  private fromEmail: string;
  private adminEmails: string[];

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.EMAIL_FROM || "TurtleLittle <orders@turtlelittle.com>";
    const adminEmailEnv = process.env.ADMIN_EMAIL || "hello@turtlelittle.com,abhishekfb35@gmail.com";
    this.adminEmails = adminEmailEnv.split(",").map(e => e.trim()).filter(Boolean);
  }

  private async getBccForType(type: string): Promise<string[]> {
    try {
      const config = await storage.getSiteConfig("notification-bcc-config");
      if (!config?.value) {
        console.log(`[BCC] No config for type="${type}"`);
        return [];
      }
      // The value is stored double-encoded (the save endpoint JSON.stringifies
      // a string that was already JSON.stringified by the frontend).
      // Parse once to get the inner JSON string, parse again to get the object.
      let step1: unknown;
      try {
        step1 = JSON.parse(config.value);
      } catch {
        step1 = config.value;
      }
      const parsed = (typeof step1 === "string" ? JSON.parse(step1) : step1) as { email?: string; types?: Record<string, boolean> };
      if (!parsed?.email?.trim()) {
        console.log(`[BCC] No email in config for type="${type}"`);
        return [];
      }
      if (!parsed.types?.[type]) {
        console.log(`[BCC] type="${type}" disabled in config`);
        return [];
      }
      const addrs = parsed.email.split(",").map(e => e.trim()).filter(Boolean);
      console.log(`[BCC] type="${type}" → ${addrs.join(", ")}`);
      return addrs;
    } catch (err) {
      console.error(`[BCC] Parse error for type="${type}":`, err);
      return [];
    }
  }

  async sendOrderConfirmation(notification: OrderNotification): Promise<NotificationResult> {
    try {
      console.log(`[Email] sendOrderConfirmation order=${notification.orderId} customer=${notification.customerEmail}`);
      const bcc = await this.getBccForType("order-placed");
      const [customerResult, adminResult] = await Promise.allSettled([
        this.resend.emails.send({
          from: this.fromEmail,
          to: notification.customerEmail,
          bcc: bcc.length ? bcc : undefined,
          subject: `Order Confirmed — #${notification.orderId.slice(-8).toUpperCase()} | TurtleLittle`,
          html: buildCustomerEmailHtml(notification),
        }),
        this.resend.emails.send({
          from: this.fromEmail,
          to: this.adminEmails,
          bcc: bcc.length ? bcc : undefined,
          subject: `New Order #${notification.orderId.slice(-8).toUpperCase()} — ${formatCurrency(notification.total)} from ${notification.customerName}`,
          html: buildAdminEmailHtml(notification),
        }),
      ]);

      const customerOk = customerResult.status === "fulfilled";
      const adminOk = adminResult.status === "fulfilled";

      if (customerOk) {
        const id = (customerResult as PromiseFulfilledResult<any>).value?.data?.id;
        console.log(`[Email] Customer email sent id=${id} bcc=${bcc.length ? bcc.join(",") : "none"}`);
      } else {
        console.error("[Email] Failed to send customer email:", (customerResult as PromiseRejectedResult).reason);
      }
      if (adminOk) {
        const id = (adminResult as PromiseFulfilledResult<any>).value?.data?.id;
        console.log(`[Email] Admin email sent id=${id}`);
      } else {
        console.error("[Email] Failed to send admin email:", (adminResult as PromiseRejectedResult).reason);
      }

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

  async sendOrderConfirmed(notification: OrderNotification): Promise<NotificationResult> {
    try {
      const bcc = await this.getBccForType("order-confirmed");
      await this.resend.emails.send({
        from: this.fromEmail,
        to: notification.customerEmail,
        bcc: bcc.length ? bcc : undefined,
        subject: `Your TurtleLittle piece is now in the making`,
        html: buildOrderConfirmedHtml(notification),
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend order confirmed error:", err);
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
      const typeKey = status === "shipped" ? "order-shipped" : status === "delivered" ? "order-delivered" : status === "cancelled" ? "order-cancelled" : `order-${status}`;
      const bcc = await this.getBccForType(typeKey);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: customerEmail,
        bcc: bcc.length ? bcc : undefined,
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
      const bcc = await this.getBccForType("welcome-coupon");
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        bcc: bcc.length ? bcc : undefined,
        subject: `Welcome to TurtleLittle! Here's Your ${discountPercent}% Discount 🎉`,
        html: `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
<p style="text-align:center;margin:0 0 10px"><img src="https://turtlelittle.com/images/email-logo.png" alt="TurtleLittle" height="40" style="height:40px"></p>
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

  async sendAbandonedCart(email: string, firstName: string, items: AbandonedCartItem[], cartUrl: string): Promise<NotificationResult> {
    try {
      const bcc = await this.getBccForType("abandoned-cart");
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        bcc: bcc.length ? bcc : undefined,
        subject: `Your TurtleLittle cart is waiting for you`,
        html: buildAbandonedCartHtml(firstName, items, cartUrl),
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend abandoned cart error:", err);
      return { success: false, channel: "resend", error: String(err) };
    }
  }

  async sendExchangeRateAlert(payload: ExchangeRateAlertPayload): Promise<NotificationResult> {
    try {
      const lastSuccessFormatted = payload.lastSuccessAt
        ? new Date(payload.lastSuccessAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })
        : "Never";
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f7f7f7;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:2px solid #d97706;overflow:hidden;">
  <div style="background:#d97706;padding:16px 24px;">
    <h1 style="color:#fff;margin:0;font-size:18px;">⚠️ Exchange Rate Alert — TurtleLittle</h1>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 12px;">Live exchange rates have <strong>not updated successfully for more than ${payload.staleHoursThreshold} hours</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr style="background:#fef9f0;">
        <td style="padding:8px 12px;color:#666;border:1px solid #f0f0f0;width:40%;">Last Successful Fetch</td>
        <td style="padding:8px 12px;color:#1a1a1a;font-weight:600;border:1px solid #f0f0f0;">${lastSuccessFormatted}</td>
      </tr>
      ${payload.lastError ? `<tr>
        <td style="padding:8px 12px;color:#666;border:1px solid #f0f0f0;">Last Error</td>
        <td style="padding:8px 12px;color:#dc2626;font-family:monospace;font-size:12px;border:1px solid #f0f0f0;">${payload.lastError}</td>
      </tr>` : ""}
    </table>
    <p style="font-size:13px;color:#666;margin:0 0 16px;">Customers may be seeing stale exchange rates. Please check connectivity to <strong>frankfurter.app</strong> or refresh rates manually from the admin panel.</p>
    <p style="font-size:12px;color:#999;margin:0;">Manage exchange rates at <strong>/admin/pricing</strong>.</p>
  </div>
</div>
</body></html>`;
      await this.resend.emails.send({
        from: this.fromEmail,
        to: payload.toEmail,
        subject: `⚠️ Exchange Rate Alert: Rates stale for >${payload.staleHoursThreshold}h — TurtleLittle`,
        html,
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend exchange rate alert error:", err);
      return { success: false, channel: "resend", error: String(err) };
    }
  }

  async sendSecurityAlert(payload: SecurityAlertPayload): Promise<NotificationResult> {
    try {
      const breakdownRows = payload.breakdown
        .map(b => `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;">${b.tier}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;">${b.cat}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#dc2626;">${b.count}</td></tr>`)
        .join("");
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f7f7f7;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:2px solid #dc2626;overflow:hidden;">
  <div style="background:#dc2626;padding:16px 24px;">
    <h1 style="color:#fff;margin:0;font-size:18px;">⚠️ Security Alert — TurtleLittle</h1>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 8px;"><strong>${payload.totalBlocks}</strong> rate-limit blocks detected in the last <strong>${payload.windowMinutes} minutes</strong>.</p>
    <p style="font-size:13px;color:#666;margin:0 0 20px;">This may indicate a bot attack, credential-stuffing attempt, or abnormal traffic spike on <strong>${payload.siteUrl || "turtlelittle.com"}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f9f9f9;">
        <th style="text-align:left;padding:6px 8px;color:#666;">Tier</th>
        <th style="text-align:left;padding:6px 8px;color:#666;">Endpoint</th>
        <th style="text-align:right;padding:6px 8px;color:#666;">Blocks</th>
      </tr></thead>
      <tbody>${breakdownRows}</tbody>
    </table>
    <p style="font-size:12px;color:#999;margin:20px 0 0;">Review your rate-limit settings at /admin/security if needed.</p>
  </div>
</div>
</body></html>`;
      await this.resend.emails.send({
        from: this.fromEmail,
        to: payload.toEmail,
        subject: `⚠️ Security Alert: ${payload.totalBlocks} blocks in ${payload.windowMinutes}min — TurtleLittle`,
        html,
      });
      return { success: true, channel: "resend" };
    } catch (err) {
      console.error("Resend security alert error:", err);
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
