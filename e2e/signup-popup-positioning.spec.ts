import { test, expect, type Page } from "@playwright/test";

const popupConfig = {
  enabled: true,
  delaySeconds: 0,
  cartAddDelaySeconds: 0,
  reshowIntervalSeconds: 0,
  incentiveText: "Sign in to TurtleLittle",
  subtitleText: "Save your wishlist, track orders, and check out faster.",
  phoneSubtitleText: "Add your phone number to complete sign-up.",
  phoneRequired: true,
  consentText: "",
  consentScrollPrompt: "Scroll to the bottom to enable agreement.",
  consentAgreementLabel: "I agree to the consent text above.",
};

async function mockSignupFlow(
  page: Page,
  options: { delaySeconds?: number; cartAddDelaySeconds?: number } = {},
) {
  const delaySeconds = options.delaySeconds ?? popupConfig.delaySeconds;
  const cartAddDelaySeconds = options.cartAddDelaySeconds ?? popupConfig.cartAddDelaySeconds;
  await page.route("https://accounts.google.com/gsi/client", route => route.abort());
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        key: "signup-popup",
        value: { ...popupConfig, delaySeconds, cartAddDelaySeconds },
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
        needsPhone: true,
        googleData: {
          firstName: "Popup",
          lastName: "Tester",
          email: "popup@example.test",
        },
      }),
    }),
  );
  await page.route("**/api/auth/google/complete", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        customer: { id: "customer-1", firstName: "Popup" },
      }),
    }),
  );

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
          accounts.callback?.({ credential: "playwright-google-credential" });
        });
        container.replaceChildren(button);
      },
    };

    Object.defineProperty(window, "google", {
      configurable: true,
      value: { accounts: { id: accounts } },
    });
  });
}

type PopupTestOptions = {
  delaySeconds?: number;
  cartAddDelaySeconds?: number;
  focusTrigger?: boolean;
};

async function loadSignupPage(page: Page, options: PopupTestOptions = {}) {
  await mockSignupFlow(page, options);
  const signupConfigResponse = page.waitForResponse("**/api/site-config/signup-popup");
  await page.goto("/");
  await signupConfigResponse;

  if (options.focusTrigger) {
    await page.evaluate(() => {
      const trigger = document.createElement("button");
      trigger.id = "signup-popup-focus-trigger";
      trigger.type = "button";
      trigger.textContent = "Open signup";
      document.body.append(trigger);
      trigger.focus();
    });
  }
}

async function openPopup(page: Page, options: PopupTestOptions = {}) {
  await loadSignupPage(page, options);

  const popup = page.getByTestId("signup-popup");
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("signup-popup-backdrop")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await popup.evaluate(element =>
    element.getAnimations().map(animation => animation.finish()),
  );
  return popup;
}

async function navigateWithinApp(page: Page, pathname: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, pathname);
}

async function openPhoneForm(page: Page) {
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByTestId("input-signup-phone")).toBeVisible();
  await expect(page.getByTestId("btn-signup-phone-submit")).toBeEnabled();
}

async function installUnderlyingClickProbe(page: Page) {
  await page.evaluate(() => {
    const target = document.createElement("button");
    target.id = "signup-popup-underlying-click-probe";
    target.type = "button";
    target.textContent = "Underlying page target";
    target.style.cssText = [
      "position: fixed",
      "z-index: 0",
      "top: 8px",
      "left: 8px",
      "width: 120px",
      "height: 32px",
    ].join(";");
    (window as unknown as { signupPopupUnderlyingClicks: number }).signupPopupUnderlyingClicks = 0;
    target.addEventListener("click", () => {
      const state = window as unknown as { signupPopupUnderlyingClicks: number };
      state.signupPopupUnderlyingClicks += 1;
    });
    document.body.append(target);
  });
}

async function expectBackdropToBlockUnderlyingPage(page: Page, useTouch = false) {
  await installUnderlyingClickProbe(page);
  if (useTouch) {
    await page.touchscreen.tap(16, 16);
  } else {
    await page.mouse.click(16, 16);
  }
  expect(
    await page.evaluate(
      () => (window as unknown as { signupPopupUnderlyingClicks: number }).signupPopupUnderlyingClicks,
    ),
  ).toBe(0);
  await expect(page.getByTestId("signup-popup-backdrop")).toBeVisible();
}

async function expectCentered(
  popup: ReturnType<Page["getByTestId"]>,
  viewport: { width: number; height: number },
) {
  const box = await popup.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(box!.y + box!.height / 2).toBeCloseTo(viewport.height / 2, 0);
}

test.describe("Signup popup positioning", () => {
  test("stays centered on desktop and keeps the phone flow interactive", async ({ page }) => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);
    const popup = await openPopup(page);

    await expectCentered(popup, viewport);
    await expect(popup).toHaveAttribute("role", "dialog");
    await expect(popup).toHaveAttribute("aria-modal", "true");
    await expect(popup).toHaveAttribute("aria-labelledby", "signup-popup-title");
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();
    await expectBackdropToBlockUnderlyingPage(page);
    await expect(popup).toBeVisible();

    await openPhoneForm(page);
    await expect(page.getByRole("dialog", { name: "Welcome, Popup Tester!" })).toBeVisible();
    await expect(page.getByTestId("btn-dismiss-phone-form")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByTestId("btn-signup-phone-submit")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("btn-dismiss-phone-form")).toBeFocused();
    await expectCentered(popup, viewport);
    await page.getByTestId("select-signup-phone-country-code").selectOption("+91");
    await page.getByTestId("input-signup-phone").fill("9876543210");

    const completionRequest = page.waitForRequest("**/api/auth/google/complete");
    await page.getByTestId("btn-signup-phone-submit").click();
    await completionRequest;
    await expect(popup).toBeHidden();
  });

  test("stays centered on mobile and keeps dismissal interactive", async ({ page }) => {
    const viewport = { width: 400, height: 720 };
    await page.setViewportSize(viewport);
    const popup = await openPopup(page);

    await expectCentered(popup, viewport);
    await expect(page.getByRole("dialog", { name: "Sign in to TurtleLittle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();
    await expectBackdropToBlockUnderlyingPage(page, true);

    await openPhoneForm(page);
    await expect(page.getByRole("dialog", { name: "Welcome, Popup Tester!" })).toBeVisible();
    await expect(page.getByTestId("btn-dismiss-phone-form")).toBeFocused();
    await expectCentered(popup, viewport);
    await page.getByTestId("input-signup-phone").fill("9876543210");
    await page.getByTestId("btn-dismiss-phone-form").click();
    await expect(popup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();
  });

  test("dismisses with Escape and restores focus to the opening element", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const popup = await openPopup(page, { delaySeconds: 1, focusTrigger: true });

    await expect(page.getByRole("dialog", { name: "Sign in to TurtleLittle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();
    await expect(page.locator("#signup-popup-focus-trigger")).toBeFocused();
  });

  test("keeps the session signup timer alive across navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadSignupPage(page, { delaySeconds: 1, cartAddDelaySeconds: 60 });

    await navigateWithinApp(page, "/shop");
    await expect(page.getByTestId("signup-popup")).toBeVisible({ timeout: 5_000 });
  });

  test("keeps the cart signup timer alive across navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadSignupPage(page, { delaySeconds: 60, cartAddDelaySeconds: 1 });
    await page.waitForTimeout(50);

    await page.evaluate(() => window.dispatchEvent(new Event("cart:item-added-for-popup")));
    await navigateWithinApp(page, "/shop");
    await expect(page.getByTestId("signup-popup")).toBeVisible({ timeout: 5_000 });
  });
});