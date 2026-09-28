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

async function loadQuickAddTimerPage(
  page: Page,
  productId: string,
  config: {
    delaySeconds: number;
    cartAddDelaySeconds: number;
    reshowIntervalSeconds: number;
  },
) {
  await page.clock.install();
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
          ...config,
          incentiveText: "Sign in to TurtleLittle",
          subtitleText: "Save your wishlist, track orders, and check out faster.",
          phoneSubtitleText: "Add your phone number to complete sign-up.",
          phoneRequired: true,
          consentText: "",
        },
      }),
    }),
  );

  const configResponse = page.waitForResponse("**/api/site-config/signup-popup");
  await page.goto("/shop");
  await configResponse;
  const quickAddButton = page.getByTestId(`button-quickadd-${productId}`);
  await expect(quickAddButton).toBeVisible();
  return {
    quickAddButton,
    quickAddSheet: page.getByTestId("quickadd-sheet-content"),
    signupPopup: page.getByTestId("signup-popup"),
  };
}

async function mockEmptyMiniCart(page: Page) {
  await page.route("**/api/cart", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        itemCount: 0,
        items: [],
        subtotal: 0,
        discount: 0,
        shippingFee: 0,
        total: 0,
        engineThresholds: null,
      }),
    }),
  );
}

function miniCartDrawer(page: Page) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByTestId("button-mini-cart-shop") });
}

async function openMiniCart(page: Page, whileQuickAddIsOpen = false) {
  const cartButton = page.getByTestId("button-cart");
  if (whileQuickAddIsOpen) {
    await cartButton.evaluate(button => (button as HTMLButtonElement).click());
  } else {
    await cartButton.click();
  }
  await expect(miniCartDrawer(page)).toHaveCount(1);
}

async function closeMiniCart(page: Page) {
  const drawer = miniCartDrawer(page);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
}

async function mockHardCartGateFlow(page: Page, initialItemCount = 0) {
  let addRequestCount = 0;
  let addedItemCount = 0;
  const addedQuantities: number[] = [];

  await page.route("https://accounts.google.com/gsi/client", route => route.abort());
  await page.route("**/api/cart", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "cart-gate-test-cart",
        items: [],
        itemCount: initialItemCount + addedItemCount,
        subtotal: (initialItemCount + addedItemCount) * 100,
        discount: 0,
        shippingFee: 0,
        total: (initialItemCount + addedItemCount) * 100,
        freeIndices: [],
        engineThresholds: null,
      }),
    }),
  );
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
    const requestBody = route.request().postDataJSON() as { quantity?: number };
    const quantity = requestBody.quantity ?? 1;
    addedQuantities.push(quantity);
    addedItemCount += quantity;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "cart-gate-test-cart",
        items: [],
        itemCount: initialItemCount + addedItemCount,
        subtotal: (initialItemCount + addedItemCount) * 100,
        discount: 0,
        shippingFee: 0,
        total: (initialItemCount + addedItemCount) * 100,
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
    getAddedQuantities: () => [...addedQuantities],
  };
}

test.describe("QuickAdd personalization — mobile (400×720)", () => {
  let singleProductId: string;
  let singleProductSlug: string;
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

  test("shows the optional-personalization scroll cue only until controls come into view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 420 });
    await page.route("**/api/cart", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "quickadd-scroll-cue-test-cart",
          items: [],
          itemCount: 0,
          subtotal: 0,
          discount: 0,
          shippingFee: 0,
          total: 0,
          freeIndices: [],
          engineThresholds: {
            retailFreeItemTrigger: 3,
            retailBonusDiscountPct: 30,
            wholesaleThreshold: 5,
          },
        }),
      }),
    );
    await page.route("**/api/site-config/signup-popup", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          key: "signup-popup",
          value: { enabled: false },
        }),
      }),
    );

    await page.goto("/shop");
    const quickAddButton = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddButton.scrollIntoViewIfNeeded();
    await quickAddButton.click();

    const sheet = page.getByTestId("quickadd-sheet-content");
    const scrollArea = page.getByTestId("quickadd-scroll-area");
    const controls = page.getByTestId("quickadd-controls-start");
    const cue = page.getByTestId("quickadd-scroll-cue");
    const submit = page.getByTestId("button-quickadd-submit");

    await expect(sheet).toBeVisible();
    await expect(controls).toBeVisible();
    await expect(cue).toBeVisible();
    await expect(cue).toContainText("Personalization is optional");
    await page.waitForTimeout(500);
    const initialSubmitBox = await submit.boundingBox();
    expect(initialSubmitBox).not.toBeNull();

    await scrollArea.evaluate((area) => {
      const controlStart = area.querySelector<HTMLElement>('[data-testid="quickadd-controls-start"]');
      if (!controlStart) throw new Error("Expected the Quick Add controls marker");
      area.scrollTop += controlStart.getBoundingClientRect().top - area.getBoundingClientRect().top - 4;
    });
    await expect(cue).toBeHidden();

    const scrolledSubmitBox = await submit.boundingBox();
    expect(scrolledSubmitBox).not.toBeNull();
    expect(scrolledSubmitBox!.y).toBeCloseTo(initialSubmitBox!.y, 0);
    await expect(submit).toBeVisible();
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
    singleProductSlug = singleProduct.slug;

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

    await expect(page.getByTestId("signup-popup")).toBeHidden();
    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
    await selectRequiredQuickAddVariant(page);
    await page.getByTestId("button-quickadd-submit").click();

    const confirmProceed = page.getByTestId("button-name-confirm-proceed");
    if (await confirmProceed.isVisible()) {
      await confirmProceed.click();
    }

    const signupPopup = page.getByTestId("signup-popup");
    const closeButton = page.getByTestId("btn-dismiss-nudge");
    await expect(page.getByTestId("quickadd-sheet-content")).toBeHidden();
    await expect(signupPopup).toBeVisible({ timeout: 10_000 });
    await expect(signupPopup).toHaveAttribute("data-trigger", "promotional");
    await expect(closeButton).toHaveCSS("width", "44px");
    await expect(closeButton).toHaveCSS("height", "44px");
    await expect(closeButton).toHaveCSS("border-top-width", "1px");

    await closeButton.tap();
    await expect(signupPopup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();
  });

  test("pauses signup countdown in Quick Add and resumes after the close grace", async ({
    page,
  }) => {
    const { quickAddButton, quickAddSheet, signupPopup } =
      await loadQuickAddTimerPage(page, singleProductId, {
        delaySeconds: 30,
        cartAddDelaySeconds: 60,
        reshowIntervalSeconds: 0,
      });
    await page.clock.runFor(5_000);

    await quickAddButton.click();
    await expect(quickAddSheet).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(quickAddSheet).toBeHidden();
    await page.clock.runFor(2_000);

    await quickAddButton.click();
    await expect(quickAddSheet).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(quickAddSheet).toBeHidden();
    await page.clock.runFor(6_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(30_000);
    await expect(signupPopup).toBeVisible();
  });

  test("keeps the session countdown paused for five seconds after a successful add", async ({
    page,
  }) => {
    await page.route("**/api/cart/items", route =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "quickadd-added-test-cart",
          items: [],
          itemCount: 1,
          subtotal: 100,
          discount: 0,
          shippingFee: 0,
          total: 100,
          freeIndices: [],
          engineThresholds: null,
        }),
      }),
    );
    const { signupPopup } = await loadQuickAddTimerPage(page, singleProductId, {
      delaySeconds: 8,
      cartAddDelaySeconds: 60,
      reshowIntervalSeconds: 0,
    });
    await page.clock.runFor(3_000);
    await submitQuickAdd(page, singleProductId);

    await expect(page.getByTestId("quickadd-sheet-content")).toBeHidden();
    await page.clock.runFor(6_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(5_000);
    await expect(signupPopup).toBeVisible();
  });

  test("resumes the remaining countdown after signup closes", async ({ page }) => {
    const { signupPopup } = await loadQuickAddTimerPage(page, singleProductId, {
      delaySeconds: 8,
      cartAddDelaySeconds: 60,
      reshowIntervalSeconds: 0,
    });
    await page.clock.runFor(3_000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("show:signin-modal", { detail: { trigger: "explicit" } }));
    });
    await expect(signupPopup).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeVisible();

    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(3_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(3_000);
    await expect(signupPopup).toBeVisible();
  });

  test("pauses the cart-trigger countdown while Quick Add is open", async ({ page }) => {
    const { quickAddButton, quickAddSheet, signupPopup } =
      await loadQuickAddTimerPage(page, singleProductId, {
        delaySeconds: 60,
        cartAddDelaySeconds: 8,
        reshowIntervalSeconds: 0,
      });

    await page.evaluate(() => window.dispatchEvent(new Event("cart:item-added-for-popup")));
    await page.clock.runFor(3_000);
    await quickAddButton.click();
    await expect(quickAddSheet).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(quickAddSheet).toBeHidden();
    await page.clock.runFor(4_999);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(3_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(2_000);
    await expect(signupPopup).toBeVisible();
  });

  test("pauses the reshow countdown while Quick Add is open", async ({ page }) => {
    const { quickAddButton, quickAddSheet, signupPopup } =
      await loadQuickAddTimerPage(page, singleProductId, {
        delaySeconds: 0,
        cartAddDelaySeconds: 60,
        reshowIntervalSeconds: 20,
      });
    await expect(signupPopup).toBeVisible();
    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(3_000);

    await quickAddButton.click();
    await expect(quickAddSheet).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(quickAddSheet).toBeHidden();
    await page.clock.runFor(18_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(7_000);
    await expect(signupPopup).toBeVisible();
  });

  test("pauses the session countdown in the mini-cart and resumes with the remaining time", async ({
    page,
  }) => {
    await mockEmptyMiniCart(page);
    const { signupPopup } = await loadQuickAddTimerPage(page, singleProductId, {
      delaySeconds: 20,
      cartAddDelaySeconds: 60,
      reshowIntervalSeconds: 0,
    });

    await page.clock.runFor(5_000);
    await openMiniCart(page);
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await closeMiniCart(page);
    await page.clock.runFor(5_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(15_000);
    await expect(signupPopup).toBeVisible();
  });

  test("pauses the cart-add countdown in the mini-cart and resumes with the remaining time", async ({
    page,
  }) => {
    await mockEmptyMiniCart(page);
    const { signupPopup } = await loadQuickAddTimerPage(page, singleProductId, {
      delaySeconds: 60,
      cartAddDelaySeconds: 20,
      reshowIntervalSeconds: 0,
    });

    await page.evaluate(() => window.dispatchEvent(new Event("cart:item-added-for-popup")));
    await page.clock.runFor(3_000);
    await openMiniCart(page);
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await closeMiniCart(page);
    await page.clock.runFor(5_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(15_000);
    await expect(signupPopup).toBeVisible();
  });

  test("pauses the re-show countdown in the mini-cart and resumes with the remaining time", async ({
    page,
  }) => {
    await mockEmptyMiniCart(page);
    const { signupPopup } = await loadQuickAddTimerPage(page, singleProductId, {
      delaySeconds: 0,
      cartAddDelaySeconds: 60,
      reshowIntervalSeconds: 20,
    });

    await expect(signupPopup).toBeVisible();
    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(3_000);

    await openMiniCart(page);
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await closeMiniCart(page);
    await page.clock.runFor(5_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(15_000);
    await expect(signupPopup).toBeVisible();
  });

  test("keeps promo timers paused until both Quick Add and the mini-cart are closed", async ({
    page,
  }) => {
    await mockEmptyMiniCart(page);
    const { quickAddButton, quickAddSheet, signupPopup } =
      await loadQuickAddTimerPage(page, singleProductId, {
        delaySeconds: 20,
        cartAddDelaySeconds: 60,
        reshowIntervalSeconds: 0,
      });

    await page.clock.runFor(3_000);
    await quickAddButton.click();
    await expect(quickAddSheet).toBeVisible();
    await openMiniCart(page, true);
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await closeMiniCart(page);
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(quickAddSheet).toBeHidden();
    await page.clock.runFor(4_999);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(1);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeHidden();
    await page.clock.runFor(10_000);
    await expect(signupPopup).toBeVisible();
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

  test("Quick Add keeps the stacked form in centered tablet and desktop sheets", async ({
    page,
  }) => {
    await page.route("**/api/auth/me", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "quickadd-authenticated-test-customer",
          name: "Quick Add Tester",
          email: "quickadd@example.test",
        }),
      }),
    );
    await page.route("**/api/cart/items", route =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "quickadd-layout-test-cart",
          items: [],
          itemCount: 1,
          subtotal: 100,
          discount: 0,
          shippingFee: 0,
          total: 100,
          freeIndices: [],
          engineThresholds: null,
        }),
      }),
    );
    await page.route("**/api/cart", route =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "quickadd-layout-test-cart",
          items: [],
          itemCount: 0,
          subtotal: 0,
          discount: 0,
          shippingFee: 0,
          total: 0,
          freeIndices: [],
          engineThresholds: {
            retailFreeItemTrigger: 3,
            retailBonusDiscountPct: 30,
            wholesaleThreshold: 5,
          },
        }),
      }),
    );
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

    const sheet = page.getByTestId("quickadd-sheet-content");
    const formLayout = page.getByTestId("quickadd-form-layout");
    await expect(sheet).toBeVisible();

    const phonePanel = await sheet.boundingBox();
    expect(phonePanel?.x ?? -1).toBe(0);
    expect(phonePanel?.width ?? 0).toBeCloseTo(400, 0);
    await expect.poll(() => formLayout.evaluate(element => getComputedStyle(element).display)).toBe("block");

    await page.setViewportSize({ width: 800, height: 900 });
    await expect.poll(() => formLayout.evaluate(element => getComputedStyle(element).display)).toBe("block");
    const tabletPanel = await sheet.boundingBox();
    if (!tabletPanel) throw new Error("Expected the tablet Quick Add panel to have a bounding box");
    expect(tabletPanel.width).toBeGreaterThan(500);
    expect(tabletPanel.width).toBeLessThan(600);
    expect(Math.abs(tabletPanel.x + tabletPanel.width / 2 - 400)).toBeLessThan(2);
    const nudgeCard = sheet.getByTestId("nudge-card");
    await expect(nudgeCard).toBeVisible();
    const tabletNudgeCard = await nudgeCard.boundingBox();
    if (!tabletNudgeCard) throw new Error("Expected the Quick Add rewards card to have a bounding box");
    const nudgeParentWidth = await nudgeCard.evaluate(element =>
      element.parentElement?.getBoundingClientRect().width ?? 0,
    );
    expect(tabletNudgeCard.width).toBeGreaterThan(nudgeParentWidth * 0.9);
    await expect.poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : NaN;
    }).toBeCloseTo(900, 0);

    const nameInput = page.getByTestId("input-quickadd-name");
    const submit = page.getByTestId("button-quickadd-submit");
    await expect(page.getByTestId("section-quickadd-personalization")).toBeVisible();
    await expect(nameInput).toHaveCSS("height", "52px");
    await expect(nameInput).toHaveCSS("font-size", "16px");
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toBeFocused();
    await selectRequiredQuickAddVariant(page);
    await nameInput.fill("A");
    const minimumLengthHint = page.getByText(/Minimum \d+ characters/);
    if (await minimumLengthHint.count()) {
      await expect(submit).toBeDisabled();
    }
    await nameInput.fill("Alex");
    await expect(sheet).toBeVisible();
    await expect(nameInput).toHaveValue("Alex");

    await page.getByTestId("button-quickadd-increase").click();
    await expect(page.getByTestId("text-quickadd-qty")).toHaveText("2");
    await page.getByTestId("button-quickadd-decrease").click();
    await expect(page.getByTestId("text-quickadd-qty")).toHaveText("1");
    await expect(submit).toBeEnabled();
    await submit.click();
    const singleNameConfirm = page.getByTestId("button-name-confirm-proceed");
    if (await singleNameConfirm.isVisible()) await singleNameConfirm.click();
    await expect(submit).toBeHidden({ timeout: 8000 });

    const couplesQuickAddButton = page.getByTestId(`button-quickadd-${couplesProductId}`);
    await couplesQuickAddButton.scrollIntoViewIfNeeded();
    await couplesQuickAddButton.click();
    await expect(page.getByTestId("section-quickadd-sizes")).toBeVisible();
    await expect(page.getByTestId("section-quickadd-personalization")).toBeVisible();
    await expect(page.getByTestId("input-quickadd-gentleman")).toHaveCSS("height", "52px");
    await expect(page.getByTestId("input-quickadd-lady")).toHaveCSS("height", "52px");
    await selectRequiredQuickAddVariant(page);
    await page.getByTestId("input-quickadd-gentleman").fill("James");
    await page.getByTestId("input-quickadd-lady").fill("Emma");
    await expect(submit).toBeEnabled();
    await submit.click();
    const couplesNameConfirm = page.getByTestId("button-name-confirm-proceed");
    if (await couplesNameConfirm.isVisible()) await couplesNameConfirm.click();
    await expect(submit).toBeHidden({ timeout: 8000 });

    await page.setViewportSize({ width: 1280, height: 900 });
    await quickAddButton.scrollIntoViewIfNeeded();
    await quickAddButton.click();
    await expect(sheet).toBeVisible();
    await expect.poll(() => formLayout.evaluate(element => getComputedStyle(element).display)).toBe("block");
    const desktopPanel = await sheet.boundingBox();
    if (!desktopPanel) throw new Error("Expected the desktop Quick Add panel to have a bounding box");
    expect(desktopPanel.width).toBeGreaterThan(500);
    expect(desktopPanel.width).toBeLessThan(600);
    expect(Math.abs(desktopPanel.x + desktopPanel.width / 2 - 640)).toBeLessThan(2);
    await expect.poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : NaN;
    }).toBeCloseTo(900, 0);
    await expect(page.getByTestId("input-quickadd-name")).not.toBeFocused();

    const desktopNameInput = page.getByTestId("input-quickadd-name");
    await desktopNameInput.fill("Alex");
    await desktopNameInput.evaluate((input) => input.blur());
    await expect(sheet).toBeVisible();
    await expect(desktopNameInput).toHaveValue("Alex");
    await expect(desktopNameInput).not.toBeFocused();
    await desktopNameInput.clear();

    await selectRequiredQuickAddVariant(page);
    await submit.click();
    const nameConfirm = page.getByTestId("button-name-confirm-cancel");
    await expect(nameConfirm).toBeVisible();
    await nameConfirm.click();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("input-quickadd-name")).not.toBeFocused();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  });

  test("requires signup before opening a second Quick Add and resumes the selection after sign-in", async ({
    page,
  }) => {
    const cartRequests = await mockHardCartGateFlow(page);
    await page.goto("/shop");

    await submitQuickAdd(page, singleProductId);
    expect(cartRequests.getAddRequestCount()).toBe(1);

    const secondProductButton = page.getByTestId(`button-quickadd-${couplesProductId}`);
    await secondProductButton.scrollIntoViewIfNeeded();
    await secondProductButton.click();
    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    await expect(page.getByTestId("button-quickadd-submit")).toBeHidden();
    expect(cartRequests.getAddRequestCount()).toBe(1);

    await page
      .getByTestId("signup-popup-google-btn")
      .getByRole("button", { name: "Continue with Google" })
      .click();

    await expect(signupPopup).toBeHidden();
    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
    expect(cartRequests.getAddRequestCount()).toBe(1);
    await expect(page.getByTestId("section-quickadd-sizes")).toBeVisible();
    await selectRequiredQuickAddVariant(page);
    await page.getByTestId("button-quickadd-submit").click();
    const confirmProceed = page.getByTestId("button-name-confirm-proceed");
    if (await confirmProceed.isVisible()) await confirmProceed.click();
    await expect.poll(cartRequests.getAddRequestCount).toBe(2);
  });

  test("dismissing the second-product gate leaves Quick Add closed", async ({
    page,
  }) => {
    const cartRequests = await mockHardCartGateFlow(page);
    await page.goto("/shop");

    await submitQuickAdd(page, singleProductId);
    const signupPopup = page.getByTestId("signup-popup");
    const secondProductButton = page.getByTestId(`button-quickadd-${couplesProductId}`);
    await secondProductButton.scrollIntoViewIfNeeded();
    await secondProductButton.click();
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    await expect(page.getByTestId("button-quickadd-submit")).toBeHidden();
    expect(cartRequests.getAddRequestCount()).toBe(1);

    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(signupPopup).toBeHidden();
    expect(cartRequests.getAddRequestCount()).toBe(1);
    await expect(page.getByTestId("button-quickadd-submit")).toBeHidden();
  });

  test("a pre-filled guest cart gates Quick Add before opening it", async ({ page }) => {
    const cartRequests = await mockHardCartGateFlow(page, 1);
    await page.goto("/shop");

    const secondProductButton = page.getByTestId(`button-quickadd-${couplesProductId}`);
    await secondProductButton.scrollIntoViewIfNeeded();
    await secondProductButton.click();

    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    await expect(page.getByTestId("button-quickadd-submit")).toBeHidden();
    expect(cartRequests.getAddRequestCount()).toBe(0);

    await page
      .getByTestId("signup-popup-google-btn")
      .getByRole("button", { name: "Continue with Google" })
      .click();

    await expect(signupPopup).toBeHidden();
    await expect(page.getByTestId("button-quickadd-submit")).toBeVisible();
    expect(cartRequests.getAddRequestCount()).toBe(0);
  });

  test("requires signup before a guest raises Quick Add quantity and restores the form after sign-in", async ({
    page,
  }) => {
    const cartRequests = await mockHardCartGateFlow(page);
    await page.goto("/shop");

    const quickAddButton = page.getByTestId(`button-quickadd-${singleProductId}`);
    await quickAddButton.scrollIntoViewIfNeeded();
    await quickAddButton.click();
    const sheet = page.getByTestId("quickadd-sheet-content");
    await expect(sheet).toBeVisible();
    await selectRequiredQuickAddVariant(page);
    const nameInput = page.getByTestId("input-quickadd-name");
    await nameInput.fill("Alex");

    await page.getByTestId("button-quickadd-increase").click();
    await expect(sheet).toBeHidden();
    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    expect(cartRequests.getAddRequestCount()).toBe(0);

    await page
      .getByTestId("signup-popup-google-btn")
      .getByRole("button", { name: "Continue with Google" })
      .click();

    await expect(signupPopup).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("text-quickadd-qty")).toHaveText("2");
    await expect(nameInput).toHaveValue("Alex");
    await expect(page.getByTestId("button-quickadd-submit")).toBeEnabled();
    await page.getByTestId("button-quickadd-submit").click();
    const confirmProceed = page.getByTestId("button-name-confirm-proceed");
    if (await confirmProceed.isVisible()) await confirmProceed.click();
    await expect.poll(cartRequests.getAddRequestCount).toBe(1);
    expect(cartRequests.getAddedQuantities()).toEqual([2]);
  });

  test("Product Details requires signup before submitting a second guest item", async ({ page }) => {
    const cartRequests = await mockHardCartGateFlow(page, 1);
    await page.goto(`/product/${singleProductSlug}`);

    const sizes = page.locator('[data-testid^="button-size-"]:not([disabled])');
    if (await sizes.count()) await sizes.first().click();
    const colors = page.locator('[data-testid^="button-color-"]:not([disabled])');
    if (await colors.count()) await colors.first().click();

    const addButton = page.getByTestId("button-add-to-cart");
    await expect(addButton).toBeEnabled();
    await addButton.click();
    const confirmProceed = page.getByTestId("button-name-confirm-proceed");
    if (await confirmProceed.isVisible()) await confirmProceed.click();

    const signupPopup = page.getByTestId("signup-popup");
    await expect(signupPopup).toBeVisible();
    await expect(signupPopup).toHaveAttribute("data-trigger", "cart-gate");
    expect(cartRequests.getAddRequestCount()).toBe(0);

    await page
      .getByTestId("signup-popup-google-btn")
      .getByRole("button", { name: "Continue with Google" })
      .click();
    await expect(signupPopup).toBeHidden();
    await expect.poll(cartRequests.getAddRequestCount).toBe(1);
  });

  test("server rejects a second guest item and a guest quantity increase", async ({ page }) => {
    const initialCart = await page.request.get("/api/cart");
    expect(initialCart.ok()).toBeTruthy();

    const firstAdd = await page.request.post("/api/cart/items", {
      data: { productId: singleProductId, quantity: 1 },
    });
    expect(firstAdd.status()).toBe(201);
    const cartAfterFirstAdd = await firstAdd.json();
    expect(cartAfterFirstAdd.itemCount).toBe(1);

    const secondAdd = await page.request.post("/api/cart/items", {
      data: { productId: couplesProductId, quantity: 1 },
    });
    expect(secondAdd.status()).toBe(403);
    expect((await secondAdd.json()).code).toBe("SIGNUP_REQUIRED");

    const quantityIncrease = await page.request.patch(
      `/api/cart/items/${cartAfterFirstAdd.items[0].id}`,
      { data: { quantity: 2 } },
    );
    expect(quantityIncrease.status()).toBe(403);
    expect((await quantityIncrease.json()).code).toBe("SIGNUP_REQUIRED");
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
    await expect(page.getByTestId("icon-quickadd-needle")).toHaveCount(1);

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
    await expect(page.getByTestId("icon-quickadd-needle")).toHaveCount(2);

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
