import { expect, test, type Page } from "@playwright/test";

const ORDER_ID = "analytics-order-123";
const ORDER_PATH = `/order/${ORDER_ID}`;
const STORAGE_KEY = `turtlelittle:gtm-purchase:${ORDER_ID}`;

const order = {
  id: ORDER_ID,
  customerId: null,
  customerName: "Analytics Test Customer",
  customerEmail: "analytics@example.com",
  customerPhone: "9876543210",
  shippingAddress: "123 Test Street",
  shippingCity: "Mumbai",
  shippingState: "Maharashtra",
  shippingPincode: "400001",
  subtotal: 799,
  discount: 0,
  shippingFee: 0,
  total: 799,
  status: "confirmed",
  paymentId: null,
  razorpayOrderId: null,
  paymentStatus: "cod",
  currency: "INR",
  notes: null,
  emailStatus: null,
  courierPartner: null,
  serviceType: null,
  trackingNumber: null,
  createdAt: null,
  updatedAt: null,
  items: [
    {
      id: "order-item-1",
      orderId: ORDER_ID,
      productId: "product-1",
      productName: "Test T-shirt",
      productPrice: 799,
      quantity: 1,
      personalizationName: null,
      selectedColor: "Blue",
      selectedSize: "M",
      isFree: false,
    },
  ],
};

async function mockOrder(page: Page) {
  await page.route(`**/api/orders/${ORDER_ID}`, async route => {
    await route.fulfill({ json: order });
  });
}

async function googleAdsPurchaseEvents(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer ?? []).filter(
      entry =>
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        entry?.event === "google_ads_purchase",
    ),
  );
}

async function gtmCustomEventsNamedPurchase(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer ?? []).filter(
      entry =>
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        entry?.event === "purchase",
    ),
  );
}

async function gtagPurchaseEvents(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer ?? [])
      .filter(
        entry =>
          typeof entry === "object" &&
          entry?.[0] === "event" &&
          entry?.[1] === "purchase",
      )
      .map(entry => entry[2]),
  );
}

async function customAnalyticsEvents(page: Page, name: string) {
  return page.evaluate(
    eventName =>
      ((window as any).__customAnalyticsEvents ?? []).filter(
        (entry: { name?: string }) => entry.name === eventName,
      ),
    name,
  );
}

async function expectOnePurchase(page: Page) {
  await expect.poll(async () => (await googleAdsPurchaseEvents(page)).length).toBe(1);
  const [purchase] = await googleAdsPurchaseEvents(page);
  expect(purchase).toMatchObject({
    event: "google_ads_purchase",
    ecommerce: {
      transaction_id: ORDER_ID,
      value: 799,
      currency: "INR",
      items: [
        {
          item_id: "product-1",
          item_name: "Test T-shirt",
          item_category: "",
          price: 799,
          quantity: 1,
        },
      ],
    },
  });
  expect(await gtmCustomEventsNamedPurchase(page)).toHaveLength(0);

  await expect.poll(async () => (await gtagPurchaseEvents(page)).length).toBe(1);
  const [gtagPurchase] = await gtagPurchaseEvents(page);
  expect(gtagPurchase).toMatchObject({
    transaction_id: ORDER_ID,
    value: 799,
    currency: "INR",
    items: [
      {
        item_id: "product-1",
        item_name: "Test T-shirt",
        item_category: "",
        price: 799,
        quantity: 1,
      },
    ],
  });
}

async function expectOneOrderCompleted(page: Page) {
  await expect.poll(async () => (await customAnalyticsEvents(page, "order_completed")).length).toBe(1);
  const [event] = await customAnalyticsEvents(page, "order_completed");
  expect(event).toEqual({
    name: "order_completed",
    data: {
      value: 799,
      currency: "INR",
      item_count: 1,
      payment_method: "cod",
    },
  });
  expect(JSON.stringify(event)).not.toContain(ORDER_ID);
  expect(JSON.stringify(event)).not.toContain(order.customerEmail);
}

test.describe("order confirmation purchase analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.dataLayer = [];
      (window as any).__customAnalyticsEvents = [];
      (window as any).umami = {
        track(name: string, data?: Record<string, string | number | boolean>) {
          (window as any).__customAnalyticsEvents.push({ name, data });
        },
      };
    });
    await mockOrder(page);
  });

  test("emits one Google Ads purchase and suppresses remounts and reloads", async ({ page }) => {
    await page.goto(ORDER_PATH);
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expectOnePurchase(page);
    await expectOneOrderCompleted(page);
    await expect(page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).resolves.toBe("1");

    await page.evaluate(() => {
      history.pushState({}, "", "/privacy");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page).toHaveURL(/\/privacy$/);
    await page.evaluate(path => {
      history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, ORDER_PATH);
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expectOnePurchase(page);
    await expectOneOrderCompleted(page);

    await page.reload();
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    expect(await googleAdsPurchaseEvents(page)).toHaveLength(0);
    expect(await gtmCustomEventsNamedPurchase(page)).toHaveLength(0);
    expect(await gtagPurchaseEvents(page)).toHaveLength(0);
    expect(await customAnalyticsEvents(page, "order_completed")).toHaveLength(0);

    await page.goto("/privacy");
    await page.goto(ORDER_PATH);
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    expect(await googleAdsPurchaseEvents(page)).toHaveLength(0);
    expect(await gtmCustomEventsNamedPurchase(page)).toHaveLength(0);
    expect(await gtagPurchaseEvents(page)).toHaveLength(0);
    expect(await customAnalyticsEvents(page, "order_completed")).toHaveLength(0);
  });

  test("uses the page-lifecycle fallback when browser storage is unavailable", async ({ page }) => {
    await page.addInitScript(prefix => {
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key.startsWith(prefix)) {
          throw new DOMException("Storage unavailable", "SecurityError");
        }
        return originalGetItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith(prefix)) {
          throw new DOMException("Storage unavailable", "SecurityError");
        }
        return originalSetItem.call(this, key, value);
      };
    }, "turtlelittle:gtm-purchase:");

    await page.goto(ORDER_PATH);
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expectOnePurchase(page);
    await expectOneOrderCompleted(page);

    await page.evaluate(() => {
      history.pushState({}, "", "/privacy");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page).toHaveURL(/\/privacy$/);
    await page.evaluate(path => {
      history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, ORDER_PATH);
    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expectOnePurchase(page);
    await expectOneOrderCompleted(page);
  });

  test("analytics failures never interrupt order confirmation", async ({ page }) => {
    await page.goto("/privacy");
    await page.evaluate(() => {
      (window as any).umami = {
        track() {
          throw new Error("Analytics unavailable");
        },
      };
    });
    await page.evaluate(path => {
      history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, ORDER_PATH);

    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expectOnePurchase(page);
  });
});