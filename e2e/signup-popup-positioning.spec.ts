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

async function mockSignupFlow(page: Page) {
  await page.route("https://accounts.google.com/gsi/client", route => route.abort());
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "signup-popup", value: popupConfig }),
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

async function openPopup(page: Page) {
  await mockSignupFlow(page);
  await page.goto("/");

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
    await expectBackdropToBlockUnderlyingPage(page);
    await expect(popup).toBeVisible();

    await openPhoneForm(page);
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
    await expectBackdropToBlockUnderlyingPage(page, true);

    await openPhoneForm(page);
    await expectCentered(popup, viewport);
    await page.getByTestId("input-signup-phone").fill("9876543210");
    await page.getByTestId("btn-dismiss-phone-form").click();
    await expect(popup).toBeHidden();
    await expect(page.getByTestId("signup-popup-backdrop")).toBeHidden();
  });
});