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

const trackedGtmPurchaseIds = new Set<string>();
const GTM_PURCHASE_STORAGE_PREFIX = "turtlelittle:gtm-purchase:";

function pushGtmPurchase(
  orderId: string,
  total: number,
  currency: string,
  items: GA4Product[],
) {
  if (typeof window === "undefined" || trackedGtmPurchaseIds.has(orderId)) return;

  const storageKey = `${GTM_PURCHASE_STORAGE_PREFIX}${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) {
      trackedGtmPurchaseIds.add(orderId);
      return;
    }
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // The in-memory set still prevents duplicates during this page lifecycle.
  }

  trackedGtmPurchaseIds.add(orderId);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: orderId,
      value: total,
      currency,
      items: items.map((p) => ({
        item_id: p.id,
        item_name: p.name,
        item_category: p.category ?? "",
        price: p.price,
        quantity: p.quantity ?? 1,
      })),
    },
  });
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
  currency = "INR",
) {
  gtag("event", "purchase", {
    transaction_id: orderId,
    currency,
    value: total,
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      item_category: p.category ?? "",
      price: p.price,
      quantity: p.quantity ?? 1,
    })),
  });
  pushGtmPurchase(orderId, total, currency, items);
}
