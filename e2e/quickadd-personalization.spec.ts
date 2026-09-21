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

async function submitQuickAdd(page: Page, productId: string) {
  const quickAddButton = page.getByTestId(`button-quickadd-${productId}`);
  await quickAddButton.scrollIntoViewIfNeeded();
  await quickAddButton.click();
  await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
  await selectRequiredQuickAddVariant(page);
  await page.getByTestId("button-quickadd-submit").click();

  const confirmProceed = page.getByTestId("button-name-confirm-proceed");
  if (await confirmProceed.isVisible()) {
    await confirmProceed.click();
  }
}

async function mockHardCartGateFlow(page: Page) {
  let addRequestCount = 0;

  await page.route("https://accounts.google.com/gsi/client", route => route.abort());
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        key: "signup-popup",
        value: {
          enabled: true,
          delaySeconds: 60,
          cartAddDelaySeconds: 0,
          reshowIntervalSeconds: 0,
          incentiveText: "Sign in to TurtleLittle",
          subtitleText: "Save your wishlist, track orders, and check out faster.",
          phoneSubtitleText: "Add your phone number to complete sign-up.",
          phoneRequired: true,
          consentText: "",
        },
      }),
    }),
  );
  await page.route("**/api/auth/google-client-id", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ clientId: "playwright-client-id" }),
    }),
  );
  await page.route("**/api/auth/google", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        needsPhone: false,
        customer: {
          id: "cart-gate-customer",
          name: "Cart Gate Tester",
          email: "cart-gate@example.test",
        },
      }),
    }),
  );
  await page.route("**/api/cart/items", async route => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    addRequestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "cart-gate-test-cart",
        items: [],
        itemCount: addRequestCount,
        subtotal: addRequestCount * 100,
        discount: 0,
        shippingFee: 0,
        total: addRequestCount * 100,
        freeIndices: [],
        engineThresholds: {
          retailFreeItemTrigger: 3,
          retailBonusDiscountPct: 30,
          wholesaleThreshold: 5,
        },
      }),
    });
  });

  await page.addInitScript(() => {
    const accounts = {
      callback: undefined as undefined | ((response: { credential: string }) => void),
      initialize(options: { callback: (response: { credential: string }) => void }) {
        accounts.callback = options.callback;
      },
      renderButton(container: HTMLElement) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Continue with Google";
        button.setAttribute("aria-label", "Continue with Google");
        button.addEventListener("click", () => {
          accounts.callback?.({ credential: "cart-gate-playwright-credential" });
        });
        container.replaceChildren(button);
      },
    };

    Object.defineProperty(window, "google", {
      configurable: true,
      value: { accounts: { id: accounts } },
    });
  });

  return {
    getAddRequestCount: () => addRequestCount,
  };
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

  test("cart-triggered signup uses the shared circular close control", async ({ page }) => {
    await page.route("**/api/site-config/signup-popup", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          key: "signup-popup",
          value: {
            enabled: true,
            delaySeconds: 60,
            cartAddDelaySeconds: 0,
            reshowIntervalSeconds: 0,
            incentiveText: "Sign in to TurtleLittle",
            subtitleText: "Save your wishlist, track orders, and check out faster.",
            phoneSubtitleText: "Add your phone number to complete sign-up.",
            phoneRequired: true,
            consentText: "",
          },
        }),
      }),
    );

    await page.goto("/shop");
    const quickAddButton = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddButton.scrollIntoViewIfNeeded();
    await quickAddButton.click();

    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
    await selectRequiredQuickAddVariant(page);
    await page.getByTestId("button-quickadd-submit").click();

    const confirmProceed = page.getByTestId("button-name-confirm-proceed");
    if (await confirmProceed.isVisible()) {
      await confirmProceed.click();
    }

    const signupPopup = page.getByTestId("signup-popup");
    const closeButton = page.getByTestId("btn-dismiss-nudge");
    await expect(signupPopup).toBeVisible({ timeout: 10_000 });
    await expect(signupPopup).toHaveAttribute("data-trigger", "promotional");
    await expect(closeButton).toHaveCSS("width", "44px");
    await expect(closeButton).toHaveCSS("height", "44px");
    await expect(closeButton).toHaveCSS("border-top-width", "1px");

    await closeButton.tap();
    await expect(signupPopup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();
  });

  test("closing signup keeps the open QuickAdd customization form open", async ({ page }) => {
    await page.route("**/api/site-config/signup-popup", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          key: "signup-popup",
          value: {
            enabled: false,
            delaySeconds: 60,
            cartAddDelaySeconds: 60,
            reshowIntervalSeconds: 0,
            incentiveText: "Sign in to TurtleLittle",
            subtitleText: "Save your wishlist, track orders, and check out faster.",
            phoneSubtitleText: "Add your phone number to complete sign-up.",
            phoneRequired: true,
            consentText: "",
          },
        }),
      }),
    );

    await page.goto("/shop");
    const quickAddButton = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddButton.scrollIntoViewIfNeeded();
    await quickAddButton.click();

    const nameInput = page.getByTestId("input-quickadd-name");
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toBeFocused();
    await nameInput.fill("Alex");
    await nameInput.evaluate((element) => element.blur());
    await expect(nameInput).not.toBeFocused();

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("show:signin-modal", {
          detail: { trigger: "explicit" },
        }),
      );
    });

    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("btn-dismiss-nudge").click();

    await expect(signupPopup).toBeHidden();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("Alex");
    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
    await expect(nameInput).not.toBeFocused();
  });

  test("hard cart gate resumes one blocked QuickAdd exactly once after sign-in", async ({
    page,
  }) => {
    const cartRequests = await mockHardCartGateFlow(page);
    await page.goto("/shop");

    await submitQuickAdd(page, singleProductId);
    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "promotional");
    expect(cartRequests.getAddRequestCount()).toBe(1);

    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();

    await submitQuickAdd(page, singleProductId);
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    expect(cartRequests.getAddRequestCount()).toBe(1);

    await page
      .getByTestId("signup-popup-google-btn")
      .getByRole("button", { name: "Continue with Google" })
      .click();

    await expect(signupPopup).toBeHidden();
    await expect.poll(cartRequests.getAddRequestCount).toBe(2);
    await page.waitForTimeout(300);
    expect(cartRequests.getAddRequestCount()).toBe(2);
    await expect(page.getByTestId("button-quickadd-submit")).toBeHidden();
  });

  test("dismissing the hard cart gate leaves the blocked QuickAdd unsubmitted", async ({
    page,
  }) => {
    const cartRequests = await mockHardCartGateFlow(page);
    await page.goto("/shop");

    await submitQuickAdd(page, singleProductId);
    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await page.getByTestId("btn-dismiss-nudge").click();

    await submitQuickAdd(page, singleProductId);
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    expect(cartRequests.getAddRequestCount()).toBe(1);

    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();
    await page.waitForTimeout(300);
    expect(cartRequests.getAddRequestCount()).toBe(1);
    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
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
