declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    /** Optional public runtime override; production normally uses VITE_META_PIXEL_ID. */
    __META_PIXEL_ID__?: string;
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

type MetaPixelFunction = ((...args: any[]) => void) & {
  callMethod?: (...args: any[]) => void;
  queue?: any[][];
  push?: (...args: any[]) => void;
  loaded?: boolean;
  version?: string;
};

const GOOGLE_ADS_PURCHASE_EVENT = "google_ads_purchase";

export type AnalyticsData = Record<string, string | number | boolean>;

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the storefront.
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
  metaId?: string;
  metaContentType?: "product" | "product_group";
}

const trackedPurchaseIds = new Set<string>();
// Keep this key stable so orders already recorded by the GTM-only guard remain protected.
const PURCHASE_TRACKED_STORAGE_PREFIX = "turtlelittle:gtm-purchase:";
const trackedMetaPurchaseIds = new Set<string>();
const META_PURCHASE_TRACKED_STORAGE_PREFIX = "turtlelittle:meta-purchase:";
const initializedMetaPixelIds = new Set<string>();
let metaPixelScriptRequested = false;
let metaPixelScriptFailed = false;
let lastMetaPageViewPath: string | null = null;

function getMetaPixelId(): string | null {
  if (typeof window === "undefined") return null;

  const configuredId = (
    window.__META_PIXEL_ID__
    ?? (typeof import.meta.env !== "undefined" ? import.meta.env.VITE_META_PIXEL_ID : undefined)
    ?? ""
  ).trim();

  return /^\d+$/.test(configuredId) ? configuredId : null;
}

function createMetaPixelStub(): MetaPixelFunction {
  const fbq: MetaPixelFunction = function (...args: any[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  };
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  return fbq;
}

function getMetaPixel(): MetaPixelFunction | null {
  const pixelId = getMetaPixelId();
  if (!pixelId || typeof window === "undefined" || metaPixelScriptFailed) return null;

  let fbq = window.fbq;
  if (!fbq) {
    fbq = createMetaPixelStub();
    if (typeof document !== "undefined" && !metaPixelScriptRequested) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.onerror = () => {
        metaPixelScriptFailed = true;
        if (fbq?.queue) fbq.queue.length = 0;
      };
      const parent = document.head ?? document.body;
      if (parent) {
        metaPixelScriptRequested = true;
        parent.appendChild(script);
      }
    }
  }

  if (!initializedMetaPixelIds.has(pixelId)) {
    initializedMetaPixelIds.add(pixelId);
    try {
      fbq("init", pixelId);
    } catch {
      // Pixel failures must never interrupt storefront behavior.
    }
  }

  return fbq;
}

function trackMetaEvent(eventName: string, parameters?: Record<string, unknown>): void {
  const fbq = getMetaPixel();
  if (!fbq) return;

  try {
    if (parameters) fbq("track", eventName, parameters);
    else fbq("track", eventName);
  } catch {
    // Pixel failures must never interrupt storefront behavior.
  }
}

function getMetaContents(products: GA4Product[]): Array<{ id: string; quantity: number }> {
  const quantities = new Map<string, number>();
  for (const product of products) {
    const id = product.metaId ?? product.id;
    const quantity = Number.isFinite(product.quantity) && (product.quantity ?? 0) > 0
      ? Math.floor(product.quantity!)
      : 1;
    quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

function getMetaContentType(products: GA4Product[]): "product" | "product_group" | undefined {
  const contentTypes = new Set(products.map(product => product.metaContentType ?? "product"));
  return contentTypes.size === 1 ? [...contentTypes][0] : undefined;
}

function getMetaCatalogParameters(
  products: GA4Product[],
  value: number,
  currency: string,
): Record<string, unknown> | null {
  if (products.length === 0) return null;

  const contents = getMetaContents(products);
  const contentType = getMetaContentType(products);
  return {
    content_ids: contents.map(content => content.id),
    contents,
    ...(contentType ? { content_type: contentType } : {}),
    currency,
    num_items: products.reduce(
      (total, product) => total + (Number.isFinite(product.quantity) && (product.quantity ?? 0) > 0
        ? Math.floor(product.quantity!)
        : 1),
      0,
    ),
    value,
  };
}

export function trackMetaPageView(location: string): void {
  const pixelId = getMetaPixelId();
  if (!pixelId) return;

  const pathname = (location.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
  if (pathname === lastMetaPageViewPath) return;

  lastMetaPageViewPath = pathname;
  trackMetaEvent("PageView");
}

function claimPurchase(orderId: string): boolean {
  if (typeof window === "undefined" || trackedPurchaseIds.has(orderId)) return false;

  const storageKey = `${PURCHASE_TRACKED_STORAGE_PREFIX}${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) {
      trackedPurchaseIds.add(orderId);
      return false;
    }
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // The in-memory set still prevents duplicates during this page lifecycle.
  }

  trackedPurchaseIds.add(orderId);
  return true;
}

function claimMetaPurchase(orderId: string): boolean {
  if (typeof window === "undefined" || trackedMetaPurchaseIds.has(orderId)) return false;

  const storageKey = `${META_PURCHASE_TRACKED_STORAGE_PREFIX}${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) {
      trackedMetaPurchaseIds.add(orderId);
      return false;
    }
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // The in-memory set still prevents duplicates during this page lifecycle.
  }

  trackedMetaPurchaseIds.add(orderId);
  return true;
}

function pushGtmPurchase(
  orderId: string,
  total: number,
  currency: string,
  items: GA4Product[],
) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: GOOGLE_ADS_PURCHASE_EVENT,
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

export function trackMetaProductView(product: GA4Product): void {
  const parameters: Record<string, unknown> = {
    content_ids: [product.metaId ?? product.id],
    contents: [{ id: product.metaId ?? product.id, quantity: 1 }],
    content_type: product.metaContentType ?? "product",
    currency: "INR",
    value: product.price,
    content_name: product.name,
  };
  if (product.category) parameters.content_category = product.category;
  trackMetaEvent("ViewContent", parameters);
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

  const metaProduct = { ...product, quantity };
  const parameters = getMetaCatalogParameters(
    [metaProduct],
    product.price * quantity,
    "INR",
  );
  if (parameters) {
    parameters.content_name = product.name;
    if (product.category) parameters.content_category = product.category;
    trackMetaEvent("AddToCart", parameters);
  }
}

export function trackBeginCheckout(items: GA4Product[], total: number, currency = "INR") {
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

  const parameters = getMetaCatalogParameters(items, total, currency);
  if (parameters) trackMetaEvent("InitiateCheckout", parameters);
}

export function trackPurchase(
  orderId: string,
  total: number,
  items: GA4Product[],
  currency = "INR",
): boolean {
  if (!claimPurchase(orderId)) return false;

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
  return true;
}

export function trackMetaPurchase(
  orderId: string,
  total: number,
  items: GA4Product[],
  currency = "INR",
): boolean {
  if (!getMetaPixelId() || !claimMetaPurchase(orderId)) return false;
  const parameters = getMetaCatalogParameters(items, total, currency);
  if (parameters) trackMetaEvent("Purchase", parameters);
  return parameters !== null;
}
