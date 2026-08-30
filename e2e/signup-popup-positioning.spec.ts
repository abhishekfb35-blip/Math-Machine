import { test, expect, type Page } from "@playwright/test";

const CONSENT_SCROLL_PROMPT = "Review all configured terms before agreeing.";
const CONSENT_AGREEMENT_LABEL = "I accept the configured signup terms.";
const LONG_CONSENT_TEXT = Array.from(
  { length: 24 },
  (_, index) => `Configured term ${index + 1} must be read before signup can continue.`,
).join(" ");

const popupConfig = {
  enabled: true,
  delaySeconds: 0,
  cartAddDelaySeconds: 0,
  reshowIntervalSeconds: 0,
  incentiveText: "Sign in to TurtleLittle",
  subtitleText: "Save your wishlist, track orders, and check out faster.",
  phoneSubtitleText: "Add your phone number to complete sign-up.",
  phoneRequired: true,
  consentText: LONG_CONSENT_TEXT,
  consentScrollPrompt: CONSENT_SCROLL_PROMPT,
  consentAgreementLabel: CONSENT_AGREEMENT_LABEL,
};

type PopupTestOptions = {
  delaySeconds?: number;
  cartAddDelaySeconds?: number;
  consentText?: string;
  completionError?: string;
  focusTrigger?: boolean;
};

async function mockSignupFlow(
  page: Page,
  options: PopupTestOptions = {},
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
        value: {
          ...popupConfig,
          delaySeconds,
          cartAddDelaySeconds,
          consentText: options.consentText ?? popupConfig.consentText,
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
        needsPhone: true,
        googleData: {
          firstName: "Popup",
          lastName: "Tester",
          email: "popup@example.test",
        },
      }),
    }),
  );
  await page.route("**/api/auth/google/complete", route => {
    if (options.completionError) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: options.completionError }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        customer: { id: "customer-1", firstName: "Popup" },
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
  await expect(page.getByTestId("btn-signup-phone-submit")).toBeVisible();
}

async function completeConsentGate(page: Page) {
  const consentRegion = page.getByTestId("signup-consent-text");
  const checkbox = page.getByTestId("signup-consent-checkbox");
  const label = page.getByTestId("signup-consent-label");
  const submitButton = page.getByTestId("btn-signup-phone-submit");

  await expect(checkbox).toBeDisabled();
  await expect(label).toContainText(CONSENT_SCROLL_PROMPT);
  await expect(submitButton).toBeDisabled();

  await consentRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect(checkbox).toBeEnabled();
  await expect(label).toContainText(CONSENT_AGREEMENT_LABEL);
  await expect(submitButton).toBeDisabled();
  await checkbox.check();
  await expect(submitButton).toBeEnabled();
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

async function installScrollablePage(page: Page) {
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "signup-popup-scroll-spacer";
    spacer.style.height = "3000px";
    spacer.setAttribute("aria-hidden", "true");
    document.body.append(spacer);
    window.scrollTo(0, 0);
  });
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
    await expect(page.getByTestId("signup-consent-text")).toBeFocused();
    await completeConsentGate(page);
    await page.keyboard.press("Tab");
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
    await expect(page.getByTestId("signup-popup-backdrop")).toHaveCSS("touch-action", "pan-y");
    await expectBackdropToBlockUnderlyingPage(page, true);

    await openPhoneForm(page);
    await expect(page.getByRole("dialog", { name: "Welcome, Popup Tester!" })).toBeVisible();
    await expect(page.getByTestId("btn-dismiss-phone-form")).toBeFocused();
    await expectCentered(popup, viewport);
    await completeConsentGate(page);
    await page.getByTestId("input-signup-phone").fill("9876543210");
    await page.getByTestId("btn-dismiss-phone-form").click();
    await expect(popup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();

    await page.evaluate(() => window.dispatchEvent(new Event("cart:item-added-for-popup")));
    await expect(popup).toBeVisible();
    await openPhoneForm(page);
    await expect(page.getByTestId("signup-consent-checkbox")).toBeDisabled();
    await expect(page.getByTestId("signup-consent-label")).toContainText(CONSENT_SCROLL_PROMPT);
    await page.getByTestId("btn-dismiss-phone-form").click();
  });

  test("enables consent immediately when the configured terms fit without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await openPopup(page, { consentText: "A short configured consent statement." });
    await openPhoneForm(page);

    await expect(page.getByTestId("signup-consent-checkbox")).toBeEnabled();
    await expect(page.getByTestId("signup-consent-label")).toContainText(CONSENT_AGREEMENT_LABEL);
  });

  test("keeps phone validation above the backdrop, focusable, and actionable", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await openPopup(page, { completionError: "That phone number is already registered." });
    await openPhoneForm(page);
    await completeConsentGate(page);

    const popup = page.getByTestId("signup-popup");
    const validationMessage = page.getByTestId("signup-phone-validation-message");
    const phoneInput = page.getByTestId("input-signup-phone");
    const submitButton = page.getByTestId("btn-signup-phone-submit");
    const popupBeforeError = await popup.boundingBox();
    expect(popupBeforeError).not.toBeNull();

    await submitButton.click();
    await expect(validationMessage).toBeVisible();
    await expect(validationMessage).toHaveAttribute("role", "alertdialog");
    await expect(validationMessage).toHaveAttribute("aria-modal", "true");
    await expect(validationMessage).toContainText("Phone number is required");
    await expect(validationMessage).toBeFocused();
    await expect(phoneInput).toHaveAttribute("aria-invalid", "true");

    const validationLayer = await validationMessage.evaluate((element) => {
      const popup = element.closest<HTMLElement>('[data-testid="signup-popup"]');
      const signupPopup = document.querySelector<HTMLElement>('[data-testid="signup-popup"]');
      const overlay = element.closest<HTMLElement>('[data-testid="signup-phone-validation-overlay"]');
      const backdrop = document.querySelector<HTMLElement>('[data-testid="signup-popup-backdrop"]');
      return {
        insidePopup: Boolean(popup),
        pointerEvents: getComputedStyle(element).pointerEvents,
        overlayZIndex: Number(getComputedStyle(overlay!).zIndex),
        popupZIndex: Number(getComputedStyle(signupPopup!).zIndex),
        backdropZIndex: Number(getComputedStyle(backdrop!).zIndex),
      };
    });
    expect(validationLayer.insidePopup).toBe(false);
    expect(validationLayer.pointerEvents).not.toBe("none");
    expect(validationLayer.overlayZIndex).toBeGreaterThan(validationLayer.popupZIndex);
    expect(validationLayer.popupZIndex).toBeGreaterThan(validationLayer.backdropZIndex);

    const popupAfterError = await popup.boundingBox();
    expect(popupAfterError).toEqual(popupBeforeError);

    await validationMessage.click();
    await expect(validationMessage).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("btn-dismiss-signup-phone-validation")).toBeFocused();
    await page.getByTestId("btn-dismiss-signup-phone-validation").click();
    await expect(validationMessage).toBeHidden();
    await expect(phoneInput).toBeFocused();

    await phoneInput.fill("9876543210");
    await page.getByTestId("select-signup-birthday-month").selectOption("1");
    await submitButton.click();
    await expect(validationMessage).toContainText("Please choose both a month and day for birthday.");
    await expect(validationMessage).toBeFocused();

    await page.getByLabel("Birthday day").selectOption("1");
    await expect(validationMessage).toBeHidden();

    const completionRequest = page.waitForRequest("**/api/auth/google/complete");
    await submitButton.click();
    await completionRequest;
    await expect(validationMessage).toContainText("Unable to create your account");
    await expect(validationMessage).toContainText("That phone number is already registered.");
    await expect(validationMessage).toBeFocused();

    await page.getByTestId("select-signup-anniversary-month").selectOption("1");
    await expect(validationMessage).toContainText("That phone number is already registered.");

    await phoneInput.fill("9123456789");
    await expect(validationMessage).toBeHidden();
  });

  test("keeps card gestures from scrolling the page while backdrop gestures can scroll it", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    const popup = await openPopup(page);
    await installScrollablePage(page);

    const nudgeTouchCancellation = await popup.evaluate((element) => {
      const target = element.querySelector<HTMLElement>('[data-testid="btn-dismiss-nudge"]')!;
      target.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true }));
      const move = new Event("touchmove", { bubbles: true, cancelable: true });
      return target.dispatchEvent(move);
    });
    expect(nudgeTouchCancellation).toBe(false);

    const backdropAllowsTouchPan = await page.getByTestId("signup-popup-backdrop").evaluate((element) => {
      const move = new Event("touchmove", { bubbles: true, cancelable: true });
      return element.dispatchEvent(move);
    });
    expect(backdropAllowsTouchPan).toBe(true);

    const nudgeBox = await popup.boundingBox();
    expect(nudgeBox).not.toBeNull();
    await page.mouse.move(
      nudgeBox!.x + nudgeBox!.width / 2,
      nudgeBox!.y + nudgeBox!.height / 2,
    );
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.mouse.move(12, 12);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await openPhoneForm(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    const phoneTouchCancellation = await popup.evaluate((element) => {
      const target = element.querySelector<HTMLElement>('[data-testid="btn-dismiss-phone-form"]')!;
      target.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true }));
      const move = new Event("touchmove", { bubbles: true, cancelable: true });
      return target.dispatchEvent(move);
    });
    expect(phoneTouchCancellation).toBe(false);

    const consentTouchAllowed = await page.getByTestId("signup-consent-text").evaluate((element) => {
      element.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true }));
      const move = new Event("touchmove", { bubbles: true, cancelable: true });
      return element.dispatchEvent(move);
    });
    expect(consentTouchAllowed).toBe(true);
    await expect(page.getByTestId("signup-consent-text")).toHaveCSS(
      "overscroll-behavior",
      "contain",
    );

    const phoneBox = await popup.boundingBox();
    expect(phoneBox).not.toBeNull();
    await page.mouse.move(
      phoneBox!.x + phoneBox!.width / 2,
      phoneBox!.y + 40,
    );
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.mouse.move(12, 12);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
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