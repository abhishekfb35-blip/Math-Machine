import { test, expect } from "@playwright/test";

test.describe("QuickAdd personalization — mobile (400×720)", () => {
  let singleProductId: string;
  let couplesProductId: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/products?limit=100");
    expect(res.ok()).toBeTruthy();
    const products = await res.json();

    const singleProduct = products.find(
      (p: { audience?: string[] }) =>
        Array.isArray(p.audience) &&
        p.audience.some((a: string) =>
          ["kids", "adults", "teens", "infant"].includes(a),
        ),
    );
    expect(
      singleProduct,
      "Expected at least one product with single-name audience",
    ).toBeTruthy();
    singleProductId = singleProduct.id;

    const couplesProduct = products.find(
      (p: { audience?: string[] }) =>
        Array.isArray(p.audience) && p.audience.includes("couples"),
    );
    expect(
      couplesProduct,
      "Expected at least one product with couples audience",
    ).toBeTruthy();
    couplesProductId = couplesProduct.id;
  });

  test("add without name → confirmation dialog → proceed without name adds item to cart", async ({
    page,
  }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const quickAddBtn = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddBtn.scrollIntoViewIfNeeded();
    await quickAddBtn.click();

    await expect(page.getByTestId("input-quickadd-name")).toBeVisible({
      timeout: 8000,
    });

    await page.getByTestId("button-quickadd-submit").click();

    await expect(
      page.getByTestId("button-name-confirm-proceed"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("button-name-confirm-cancel")).toBeVisible();

    await page.getByTestId("button-name-confirm-proceed").click();

    await expect(page.getByTestId("button-name-confirm-proceed")).not.toBeVisible({
      timeout: 5000,
    });

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator('[data-testid^="cart-item-"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 8000 });
  });

  test("enter a name → item added with personalization text visible in cart", async ({
    page,
  }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const quickAddBtn = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddBtn.scrollIntoViewIfNeeded();
    await quickAddBtn.click();

    const nameInput = page.getByTestId("input-quickadd-name");
    await expect(nameInput).toBeVisible({ timeout: 8000 });

    await nameInput.fill("Alex");

    await page.getByTestId("button-quickadd-submit").click();

    await expect(page.getByTestId("button-quickadd-submit")).not.toBeVisible({
      timeout: 8000,
    });

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator('[data-testid^="cart-item-"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 8000 });

    const personalizationEl = page.locator('[data-testid^="text-personalization-"]');
    await expect(personalizationEl.first()).toBeVisible({ timeout: 5000 });
    await expect(personalizationEl.first()).toContainText("Alex");
  });

  test("couples product: enter both names → item added with couple personalization in cart", async ({
    page,
  }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const quickAddBtn = page.getByTestId(`button-quickadd-${couplesProductId}`);
    await quickAddBtn.scrollIntoViewIfNeeded();
    await quickAddBtn.click();

    const gentlemanInput = page.getByTestId("input-quickadd-gentleman");
    await expect(gentlemanInput).toBeVisible({ timeout: 8000 });

    await gentlemanInput.fill("James");
    await page.getByTestId("input-quickadd-lady").fill("Emma");

    await page.getByTestId("button-quickadd-submit").click();

    await expect(page.getByTestId("button-quickadd-submit")).not.toBeVisible({
      timeout: 8000,
    });

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator('[data-testid^="cart-item-"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 8000 });

    const personalizationEl = page.locator('[data-testid^="text-personalization-"]');
    await expect(personalizationEl.first()).toBeVisible({ timeout: 5000 });
    await expect(personalizationEl.first()).toContainText("James");
    await expect(personalizationEl.first()).toContainText("Emma");
  });
});
