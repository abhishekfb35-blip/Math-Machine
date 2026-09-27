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