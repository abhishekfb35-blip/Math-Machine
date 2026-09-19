import { expect, test, type Page } from "@playwright/test";

const signupPopupConfig = {
  enabled: true,
  delaySeconds: 60,
  cartAddDelaySeconds: 60,
  reshowIntervalSeconds: 0,
  incentiveText: "Sign in to TurtleLittle",
  subtitleText: "Save your wishlist, track orders, and check out faster.",
  phoneSubtitleText: "Add your phone number to complete sign-up.",
  phoneRequired: true,
  consentText: "",
  consentScrollPrompt: "Scroll to continue.",
  consentAgreementLabel: "I agree.",
};

async function mockAuthenticatedWishlistFlow(page: Page) {
  await page.route("https://accounts.google.com/gsi/client", route => route.abort());
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/site-config/signup-popup", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ key: "signup-popup", value: signupPopupConfig }),
    }),
  );
  await page.route("**/api/site-config/wishlist-signup-prompt", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        key: "wishlist-signup-prompt",
        value: {
          enabled: true,
          delaySeconds: 60,
          sessionDelaySeconds: 60,
          headline: "Keep your wishlist",
          bodyText: "Sign in to preserve every saved item.",
          ctaText: "Save my wishlist",
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
          id: "wishlist-customer",
          name: "Wishlist Tester",
          email: "wishlist@example.test",
        },
      }),
    }),
  );

  await page.addInitScript(() => {
    localStorage.removeItem("tl_wishlist");
    sessionStorage.removeItem("tl_wishlist_prompt_dismissed");

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
          accounts.callback?.({ credential: "wishlist-playwright-credential" });
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

test("preserves unique guest wishlist items when shared-modal sign-in completes", async ({
  page,
}) => {
  await mockAuthenticatedWishlistFlow(page);

  const syncRequests: string[][] = [];
  await page.route("**/api/wishlist/sync", async route => {
    const body = route.request().postDataJSON() as { productIds: string[] };
    syncRequests.push(body.productIds);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        productIds: [...new Set(["existing-account-item", ...body.productIds])],
      }),
    });
  });

  await page.goto("/shop");
  const productCards = page.locator('[data-testid^="card-product-"]');
  await expect(productCards.first()).toBeVisible();
  expect(await productCards.count()).toBeGreaterThanOrEqual(2);

  const guestProductIds = await Promise.all(
    [0, 1].map(async index =>
      (await productCards.nth(index).getAttribute("data-testid"))!.replace(
        "card-product-",
        "",
      ),
    ),
  );

  for (const productId of guestProductIds) {
    await page.getByTestId(`button-wishlist-${productId}`).click();
    await expect(
      page.getByTestId(`button-wishlist-${productId}`),
    ).toHaveAttribute("aria-label", "Remove from wishlist");
  }

  await expect(page.getByTestId("badge-wishlist-count")).toHaveText("2");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("tl_wishlist") ?? "[]")),
    )
    .toEqual(guestProductIds);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("wishlist:force-preview"));
  });
  const wishlistPrompt = page.getByTestId("wishlist-signup-prompt");
  await expect(wishlistPrompt).toBeVisible();
  await expect(page.getByTestId("wishlist-prompt-count")).toContainText("2 items");

  await page.getByTestId("wishlist-prompt-signin").click();
  await expect(wishlistPrompt).toBeHidden();

  const signupPopup = page.getByTestId("signup-popup");
  await expect(signupPopup).toBeVisible();
  await expect(signupPopup).toHaveAttribute("data-trigger", "explicit");
  await page
    .getByTestId("signup-popup-google-btn")
    .getByRole("button", { name: "Continue with Google" })
    .click();

  await expect(signupPopup).toBeHidden();
  await expect.poll(() => syncRequests.length).toBe(1);
  expect([...syncRequests[0]].sort()).toEqual([...guestProductIds].sort());
  expect(new Set(syncRequests[0]).size).toBe(guestProductIds.length);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("tl_wishlist")))
    .toBeNull();
  await expect(page.getByTestId("badge-wishlist-count")).toHaveText("3");

  for (const productId of guestProductIds) {
    await expect(
      page.getByTestId(`button-wishlist-${productId}`),
    ).toHaveAttribute("aria-label", "Remove from wishlist");
  }
});