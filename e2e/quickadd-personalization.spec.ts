import { test, expect, type Page } from "@playwright/test";

async function selectRequiredQuickAddVariant(page: Page) {
  const submit = page.getByTestId("button-quickadd-submit");
  if (!(await submit.isDisabled())) return;

  const sizes = page.locator('[data-testid^="button-quickadd-size-"]:not([disabled])');
  const sizeCount = await sizes.count();
  for (let index = 0; index < sizeCount; index += 1) {
    await sizes.nth(index).click();
    const color = page.locator('[data-testid^="button-quickadd-color-"]:not([disabled])').first();
    if (await color.count()) await color.click();
  }

  await expect(submit).toBeEnabled();
}

test.describe("QuickAdd personalization — mobile (400×720)", () => {
  let singleProductId: string;
  let couplesProductId: string;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__customAnalyticsEvents = [];
      (window as any).umami = {
        track(name: string, data?: Record<string, string | number | boolean>) {
          (window as any).__customAnalyticsEvents.push({ name, data });
        },
      };
    });
  });

  test.beforeAll(async ({ request }) => {
    const [productsResponse, attributesResponse] = await Promise.all([
      request.get("/api/products?limit=100"),
      request.get("/api/attributes"),
    ]);
    expect(productsResponse.ok()).toBeTruthy();
    expect(attributesResponse.ok()).toBeTruthy();
    const products = await productsResponse.json();
    const attributes = await attributesResponse.json();
    const audienceIdByName = new Map<string, string>(
      attributes.audience.map((entry: { id: string; name: string }) => [entry.name, entry.id]),
    );
    const singleAudienceIds = new Set(
      ["kids", "adults", "teens", "infant"]
        .map(name => audienceIdByName.get(name))
        .filter((id): id is string => Boolean(id)),
    );
    const couplesAudienceId = audienceIdByName.get("couples");

    const singleProduct = products.find(
      (p: { audience?: string[] }) =>
        Array.isArray(p.audience) &&
        p.audience.some((audienceId: string) => singleAudienceIds.has(audienceId)),
    );
    expect(
      singleProduct,
      "Expected at least one product with single-name audience",
    ).toBeTruthy();
    singleProductId = singleProduct.id;

    const couplesProduct = products.find(
      (p: { audience?: string[] }) =>
        Array.isArray(p.audience) &&
        Boolean(couplesAudienceId) &&
        p.audience.includes(couplesAudienceId),
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

    await expect.poll(() => page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "quick_add_opened",
      ).length,
    )).toBe(1);

    await expect(page.getByTestId("input-quickadd-name")).toBeVisible({
      timeout: 8000,
    });

    await page.getByTestId("button-quickadd-submit").click();

    await expect(
      page.getByTestId("button-name-confirm-proceed"),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("button-name-confirm-cancel")).toBeVisible();
    expect(await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "cart_item_added",
      ),
    )).toHaveLength(0);

    await page.getByTestId("button-name-confirm-proceed").click();

    await expect(page.getByTestId("button-name-confirm-proceed")).not.toBeVisible({
      timeout: 5000,
    });

    await expect.poll(() => page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "cart_item_added",
      ).length,
    )).toBe(1);
    const [cartEvent] = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "cart_item_added",
      ),
    );
    expect(cartEvent).toMatchObject({
      name: "cart_item_added",
      data: {
        product_id: singleProductId,
        quantity: 1,
        has_personalization: false,
        source: "quick_add",
      },
    });
    expect(typeof cartEvent.data.has_variant).toBe("boolean");

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator('[data-testid^="cart-item-"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 8000 });

    await page.getByTestId("button-checkout").click();
    await expect(page.getByTestId("text-checkout-title")).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "checkout_started",
      ).length,
    )).toBe(1);
    const [checkoutEvent] = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "checkout_started",
      ),
    );
    expect(checkoutEvent.data).toMatchObject({
      item_count: 1,
      currency: "INR",
      has_discount: false,
    });
    expect(typeof checkoutEvent.data.value).toBe("number");
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
    await selectRequiredQuickAddVariant(page);

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
