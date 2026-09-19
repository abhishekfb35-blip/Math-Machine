import { expect, test, type Page } from "@playwright/test";

const checkoutCart = {
  id: "checkout-signin-cart",
  items: [
    {
      id: "checkout-signin-item",
      cartId: "checkout-signin-cart",
      productId: "checkout-signin-product",
      quantity: 1,
      personalizationName: null,
      selectedColor: null,
      selectedSize: null,
      effectivePrice: 999,
      originalEffectivePrice: 999,
      isFreeItem: false,
      bonusDiscountPct: 0,
      product: {
        id: "checkout-signin-product",
        name: "Checkout Sign-in Test Towel",
        slug: "checkout-signin-test-towel",
        imageUrl: "/images/products/medium/unicorn-pony-kids-bath-towel.jpg",
        galleryImages: [],
        price: 999,
        mrp: 1299,
      },
    },
  ],
  itemCount: 1,
  subtotal: 999,
  discount: 0,
  shippingFee: 0,
  total: 999,
  freeIndices: [],
  engineThresholds: {
    retailFreeItemTrigger: 3,
    retailBonusDiscountPct: 30,
    wholesaleThreshold: 5,
  },
};

async function mockCheckoutSignInFlow(page: Page) {
  let createOrderRequestCount = 0;

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
          enabled: false,
          delaySeconds: 60,
          cartAddDelaySeconds: 60,
          reshowIntervalSeconds: 0,
          incentiveText: "Promotional sign-in copy",
          subtitleText: "Promotional subtitle",
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
          id: "checkout-signin-customer",
          name: "Checkout Tester",
          email: "checkout@example.test",
        },
      }),
    }),
  );
  await page.route("**/api/cart", route => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(checkoutCart),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/razorpay/key", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ available: true, keyId: "playwright-key" }),
    }),
  );
  await page.route("**/api/site-config/payment-methods", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        key: "payment-methods",
        value: { codEnabled: true },
      }),
    }),
  );
  await page.route("**/api/cart/checkout-started", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );
  await page.route("**/api/razorpay/create-order", route => {
    createOrderRequestCount += 1;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        razorpayOrderId: "playwright-razorpay-order",
        amount: 999,
        currency: "INR",
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
          accounts.callback?.({ credential: "checkout-playwright-credential" });
        });
        container.replaceChildren(button);
      },
    };

    Object.defineProperty(window, "google", {
      configurable: true,
      value: { accounts: { id: accounts } },
    });

    (window as any).__razorpayOpenCount = 0;
    (window as any).Razorpay = function Razorpay() {
      return {
        on() {},
        open() {
          (window as any).__razorpayOpenCount += 1;
        },
      };
    };
  });

  return {
    getCreateOrderRequestCount: () => createOrderRequestCount,
    getRazorpayOpenCount: () =>
      page.evaluate(() => (window as any).__razorpayOpenCount as number),
  };
}

async function submitOnlineCheckout(page: Page) {
  await page.goto("/checkout");
  await expect(page.getByTestId("text-checkout-title")).toBeVisible();

  await page.getByTestId("input-customer-name").fill("Checkout Tester");
  await page.getByTestId("input-customer-email").fill("checkout@example.test");
  await page.getByTestId("input-customer-phone").fill("9990079722");
  await page.getByTestId("input-shipping-address").fill("1 Test Street");
  await page.getByTestId("input-shipping-city").fill("Noida");
  await page.getByTestId("input-shipping-state").fill("Uttar Pradesh");
  await page.getByTestId("input-shipping-pincode").fill("201301");
  await page.getByTestId("button-payment-razorpay").click();
  await page.getByTestId("button-place-order").click();

  const signupPopup = page.getByTestId("signup-popup");
  await expect(signupPopup).toBeVisible();
  await expect(signupPopup).toHaveAttribute("data-trigger", "explicit");
  return signupPopup;
}

async function completeSharedSignIn(page: Page) {
  await page
    .getByTestId("signup-popup-google-btn")
    .getByRole("button", { name: "Continue with Google" })
    .click();
  await expect(page.getByTestId("signup-popup")).toBeHidden();
}

test("dismissed checkout sign-in cannot submit later after separate authentication", async ({
  page,
}) => {
  const checkout = await mockCheckoutSignInFlow(page);
  const signupPopup = await submitOnlineCheckout(page);

  await page.getByTestId("btn-dismiss-nudge").click();
  await expect(signupPopup).toBeHidden();
  expect(checkout.getCreateOrderRequestCount()).toBe(0);

  await page.getByTestId("button-signin").click();
  await expect(signupPopup).toBeVisible();
  await completeSharedSignIn(page);

  await page.waitForTimeout(500);
  expect(checkout.getCreateOrderRequestCount()).toBe(0);
  expect(await checkout.getRazorpayOpenCount()).toBe(0);
});

test("successful checkout-owned sign-in resumes online payment exactly once", async ({
  page,
}) => {
  const checkout = await mockCheckoutSignInFlow(page);
  await submitOnlineCheckout(page);

  await completeSharedSignIn(page);

  await expect.poll(checkout.getCreateOrderRequestCount).toBe(1);
  await expect.poll(checkout.getRazorpayOpenCount).toBe(1);
  await page.waitForTimeout(500);
  expect(checkout.getCreateOrderRequestCount()).toBe(1);
  expect(await checkout.getRazorpayOpenCount()).toBe(1);
});