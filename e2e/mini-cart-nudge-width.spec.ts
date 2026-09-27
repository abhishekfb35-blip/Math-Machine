import { test, expect, type Locator, type Page } from "@playwright/test";

const engineThresholds = {
  retailFreeItemTrigger: 3,
  retailBonusDiscountPct: 30,
  wholesaleThreshold: 5,
};

const emptyCart = {
  id: "mini-cart-nudge-width-test-cart",
  items: [],
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  shippingFee: 0,
  total: 0,
  freeIndices: [],
  engineThresholds,
};

const populatedCart = {
  ...emptyCart,
  items: [
    {
      id: "mini-cart-nudge-width-test-item",
      quantity: 1,
      product: {
        id: "mini-cart-nudge-width-test-product",
        slug: "mini-cart-nudge-width-test-product",
        imageUrl: "",
        name: "Mini-cart width test towel",
        price: 1998,
      },
    },
  ],
  itemCount: 1,
  subtotal: 1998,
  total: 1998,
};

function createLongCart() {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `mini-cart-long-item-${index + 1}`,
    quantity: 1,
    product: {
      id: `mini-cart-long-product-${index + 1}`,
      slug: `mini-cart-long-product-${index + 1}`,
      imageUrl: "",
      name: `Long cart test product ${index + 1}`,
      price: 1998,
    },
  }));
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const discount = 1199;
  const shippingFee = 499;

  return {
    ...emptyCart,
    engineThresholds: { ...engineThresholds, wholesaleThreshold: 20 },
    items,
    itemCount: items.length,
    subtotal,
    discount,
    shippingFee,
    total: subtotal - discount + shippingFee,
  };
}

async function expectNudgeToFillAvailableWidth(nudge: Locator) {
  const dimensions = await nudge.evaluate(element => {
    const parent = element.parentElement;
    if (!parent) return null;

    const parentRect = parent.getBoundingClientRect();
    const parentStyle = getComputedStyle(parent);
    const availableWidth =
      parentRect.width -
      Number.parseFloat(parentStyle.paddingLeft) -
      Number.parseFloat(parentStyle.paddingRight);

    return {
      cardWidth: element.getBoundingClientRect().width,
      availableWidth,
    };
  });

  if (!dimensions) throw new Error("Expected the nudge card to have a layout parent");
  expect(dimensions.cardWidth).toBeGreaterThan(dimensions.availableWidth * 0.98);
}

test("header mini-cart nudge fills available width when empty and populated", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });

  let cart = emptyCart;
  await page.route("**/api/cart", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(cart),
    }),
  );
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "signup-popup", value: { enabled: false } }),
    }),
  );

  await page.goto("/");
  await page.getByTestId("button-cart").click();

  const teaser = page.getByTestId("mini-cart-teaser").getByTestId("nudge-card");
  await expect(teaser).toBeVisible();
  await expectNudgeToFillAvailableWidth(teaser);

  cart = populatedCart;
  await page.reload();
  await page.getByTestId("button-cart").click();

  const nudge = page.getByTestId("mini-cart-nudge").getByTestId("nudge-card");
  await expect(nudge).toBeVisible();
  await expectNudgeToFillAvailableWidth(nudge);
  await expect(page.getByTestId("button-mini-cart-checkout")).toBeVisible();

  await page.setViewportSize({ width: 400, height: 720 });
  await page.reload();
  await page.getByTestId("button-cart").click();

  const mobileNudge = page.getByTestId("mini-cart-nudge").getByTestId("nudge-card");
  await expect(mobileNudge).toBeVisible();
  await expectNudgeToFillAvailableWidth(mobileNudge);
  await expect(page.getByTestId("button-mini-cart-checkout")).toBeVisible();
});

async function expectMiniCartFooterInViewport(page: Page) {
  for (const testId of [
    "mini-cart-subtotal",
    "mini-cart-discount",
    "mini-cart-saving",
    "mini-cart-delivery",
    "mini-cart-total",
    "mini-cart-discount-footnote",
    "button-mini-cart-view-cart",
    "button-mini-cart-checkout",
  ]) {
    const element = page.getByTestId(testId);
    await expect(element).toBeVisible();
    await expect(element).toBeInViewport({ ratio: 1 });
  }
}

test("long mini-cart lists scroll without moving totals or checkout actions", async ({ page }) => {
  let cart = createLongCart();
  await page.route("**/api/cart", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(cart),
    }),
  );
  await page.route("**/api/cart/items/**", async route => {
    const request = route.request();
    const itemId = request.url().split("/").at(-1);

    if (request.method() === "PATCH") {
      const { quantity } = request.postDataJSON() as { quantity: number };
      cart = {
        ...cart,
        items: cart.items.map(item => item.id === itemId ? { ...item, quantity } : item),
      };
    } else if (request.method() === "DELETE") {
      cart = {
        ...cart,
        items: cart.items.filter(item => item.id !== itemId),
      };
    } else {
      return route.continue();
    }

    cart.itemCount = cart.items.reduce((count, item) => count + item.quantity, 0);
    cart.subtotal = cart.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    );
    cart.total = cart.subtotal - cart.discount + cart.shippingFee;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(cart),
    });
  });
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "signup-popup", value: { enabled: false } }),
    }),
  );

  const viewportCases = [
    { width: 400, height: 420, action: "view-cart" },
    { width: 1024, height: 420, action: "checkout" },
  ] as const;

  for (const { width, height, action } of viewportCases) {
    cart = createLongCart();
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByTestId("button-cart").click();

    const itemList = page.getByTestId("mini-cart-items");
    await expect(itemList).toBeVisible();
    expect(await itemList.evaluate(element => element.scrollHeight))
      .toBeGreaterThan(await itemList.evaluate(element => element.clientHeight));

    await itemList.evaluate(element => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => itemList.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByTestId("mini-cart-item-mini-cart-long-item-12")).toBeVisible();
    await expectMiniCartFooterInViewport(page);

    await page.getByTestId("button-mini-increase-qty-mini-cart-long-item-12").click();
    await expect(page.getByTestId("text-mini-qty-mini-cart-long-item-12")).toHaveText("2");
    await expectMiniCartFooterInViewport(page);

    await page.getByTestId("button-mini-remove-item-mini-cart-long-item-1").click();
    await expect(page.getByTestId("mini-cart-item-mini-cart-long-item-1")).toHaveCount(0);
    await expectMiniCartFooterInViewport(page);

    if (action === "view-cart") {
      await page.getByTestId("button-mini-cart-view-cart").click();
      await expect(page).toHaveURL(/\/cart$/);
    } else {
      await page.getByTestId("button-mini-cart-checkout").click();
      await expect(page).toHaveURL(/\/checkout$/);
    }
  }
});