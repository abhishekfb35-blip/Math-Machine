export interface OrderNotification {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  itemCount: number;
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

export function createNotificationService(): INotificationService {
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
