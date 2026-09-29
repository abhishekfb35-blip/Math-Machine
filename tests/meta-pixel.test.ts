import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  trackAddToCart,
  trackBeginCheckout,
  trackMetaPageView,
  trackMetaPurchase,
  trackMetaProductView,
  trackProductView,
  trackPurchase,
} from "../client/src/lib/analytics.ts";

const originalWindow = (globalThis as any).window;
const originalDocument = (globalThis as any).document;
let testPixelId = 100000000000000;

function installPixelMock(pixelId?: string) {
  const calls: any[][] = [];
  const values = new Map<string, string>();
  const windowMock: any = {
    dataLayer: [],
    fbq: (...args: any[]) => calls.push(args),
    localStorage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    },
  };
  if (pixelId) windowMock.__META_PIXEL_ID__ = pixelId;
  (globalThis as any).window = windowMock;
  return { calls, windowMock };
}

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
  if (originalDocument === undefined) delete (globalThis as any).document;
  else (globalThis as any).document = originalDocument;
});

test("standard Meta events include catalog IDs, values, quantities, and no order/customer details", () => {
  const { calls, windowMock } = installPixelMock(String(++testPixelId));
  const variantId = "product-1__variant";

  trackMetaPageView("/shop?private=ignored");
  trackMetaPageView("/shop");
  trackMetaPageView("/admin/orders");
  trackProductView({
    id: "product-1",
    name: "Cotton towel",
    price: 799,
  });
  trackMetaProductView({
    id: "product-1",
    name: "Cotton towel",
    price: 799,
    metaId: "product-1",
    metaContentType: "product_group",
  });
  trackAddToCart(
    {
      id: "product-1",
      name: "Cotton towel",
      price: 799,
      metaId: variantId,
    },
    2,
  );

  const items = [
    {
      id: "product-1",
      name: "Cotton towel",
      price: 799,
      quantity: 2,
      metaId: variantId,
      metaContentType: "product" as const,
    },
    {
      id: "product-2",
      name: "Gift wrap",
      price: 99,
      quantity: 1,
      metaId: "product-2",
      metaContentType: "product_group" as const,
    },
  ];
  trackBeginCheckout(items, 1697, "INR");
  assert.equal(trackPurchase("internal-order-id", 1697, items, "INR"), true);
  assert.equal(trackPurchase("internal-order-id", 1697, items, "INR"), false);
  assert.equal(trackMetaPurchase("internal-order-id", 1697, items, "INR"), true);
  assert.equal(trackMetaPurchase("internal-order-id", 1697, items, "INR"), false);

  const events = calls
    .filter(([command]) => command === "track")
    .map(([, name, parameters]) => ({ name, parameters }));

  assert.equal(calls.filter(([command]) => command === "init").length, 1);
  assert.deepEqual(events.filter(event => event.name === "PageView").map(event => event.name), ["PageView"]);
  assert.deepEqual(events.find(event => event.name === "ViewContent")?.parameters, {
    content_ids: ["product-1"],
    contents: [{ id: "product-1", quantity: 1 }],
    content_type: "product_group",
    currency: "INR",
    value: 799,
    content_name: "Cotton towel",
  });
  assert.deepEqual(events.find(event => event.name === "AddToCart")?.parameters, {
    content_ids: [variantId],
    contents: [{ id: variantId, quantity: 2 }],
    content_type: "product",
    currency: "INR",
    num_items: 2,
    value: 1598,
    content_name: "Cotton towel",
  });

  const checkout = events.find(event => event.name === "InitiateCheckout")?.parameters;
  assert.equal(checkout?.value, 1697);
  assert.equal(checkout?.currency, "INR");
  assert.equal(checkout?.num_items, 3);
  assert.deepEqual(checkout?.content_ids, [variantId, "product-2"]);
  assert.deepEqual(checkout?.contents, [
    { id: variantId, quantity: 2 },
    { id: "product-2", quantity: 1 },
  ]);
  assert.equal("content_type" in (checkout ?? {}), false);

  const purchases = events.filter(event => event.name === "Purchase");
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].parameters.value, 1697);
  assert.equal(purchases[0].parameters.currency, "INR");
  assert.deepEqual(purchases[0].parameters.content_ids, [variantId, "product-2"]);
  assert.equal("transaction_id" in purchases[0].parameters, false);
  assert.equal(JSON.stringify(events).includes("internal-order-id"), false);
  assert.equal(JSON.stringify(events).includes("customer@example.com"), false);
  assert.ok(windowMock.localStorage);
});

test("Pixel remains disabled without a valid configured ID", () => {
  const { calls, windowMock } = installPixelMock();
  delete windowMock.fbq;
  windowMock.__META_PIXEL_ID__ = "not-a-pixel-id";

  trackMetaPageView("/cart");
  trackProductView({ id: "product-1", name: "Cotton towel", price: 799 });
  trackMetaProductView({ id: "product-1", name: "Cotton towel", price: 799 });
  trackAddToCart({ id: "product-1", name: "Cotton towel", price: 799 });
  trackBeginCheckout([{ id: "product-1", name: "Cotton towel", price: 799 }], 799);
  assert.equal(trackMetaPurchase("order-without-pixel", 799, [], "INR"), false);

  assert.deepEqual(calls, []);
  assert.equal(windowMock.fbq, undefined);
  assert.equal(
    windowMock.localStorage.getItem("turtlelittle:meta-purchase:order-without-pixel"),
    null,
  );
});

test("loads the Meta script only when configured", () => {
  const pixelId = String(++testPixelId);
  const { windowMock } = installPixelMock(pixelId);
  delete windowMock.fbq;
  const scripts: any[] = [];
  (globalThis as any).document = {
    createElement(tagName: string) {
      return { tagName, async: false, src: "", onerror: null };
    },
    head: {
      appendChild(script: any) {
        scripts.push(script);
      },
    },
  };

  trackMetaPageView("/checkout");

  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].tagName, "script");
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].src, "https://connect.facebook.net/en_US/fbevents.js");
  assert.deepEqual(windowMock.fbq.queue, [
    ["init", pixelId],
    ["track", "PageView"],
  ]);
});

test("Pixel exceptions never interrupt storefront tracking", () => {
  installPixelMock(String(++testPixelId));
  (globalThis as any).window.fbq = () => {
    throw new Error("Pixel unavailable");
  };

  assert.doesNotThrow(() => {
    trackProductView({ id: "product-1", name: "Cotton towel", price: 799 });
    trackAddToCart({ id: "product-1", name: "Cotton towel", price: 799 });
  });
});