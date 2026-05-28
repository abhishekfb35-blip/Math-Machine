declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

function gtag(...args: any[]) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag(...args);
}

export interface GA4Product {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity?: number;
}

export function trackProductView(product: GA4Product) {
  gtag("event", "view_item", {
    currency: "INR",
    value: product.price,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category ?? "",
        price: product.price,
        quantity: 1,
      },
    ],
  });
}

export function trackAddToCart(product: GA4Product, quantity = 1) {
  gtag("event", "add_to_cart", {
    currency: "INR",
    value: product.price * quantity,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category ?? "",
        price: product.price,
        quantity,
      },
    ],
  });
}

export function trackBeginCheckout(items: GA4Product[], total: number) {
  gtag("event", "begin_checkout", {
    currency: "INR",
    value: total,
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      item_category: p.category ?? "",
      price: p.price,
      quantity: p.quantity ?? 1,
    })),
  });
}

export function trackPurchase(
  orderId: string,
  total: number,
  items: GA4Product[],
) {
  gtag("event", "purchase", {
    transaction_id: orderId,
    currency: "INR",
    value: total,
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      item_category: p.category ?? "",
      price: p.price,
      quantity: p.quantity ?? 1,
    })),
  });
}
