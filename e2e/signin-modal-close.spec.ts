import { expect, test } from "@playwright/test";

test.describe("Shared sign-in popup close control", () => {
  test("opens from the real desktop Header sign-in control", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await page.getByTestId("button-signin").click();

    const modal = page.getByTestId("signup-popup");
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-trigger", "explicit");
    await expect(page.getByTestId("signin-launcher")).toHaveCount(0);
    await expect(page.getByTestId("signin-modal")).toHaveCount(0);
  });

  test("opens from the real mobile Account tab without navigating away", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await page.goto("/shop");

    await page.getByTestId("tab-account").click();

    const modal = page.getByTestId("signup-popup");
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-trigger", "explicit");
    await expect(page).toHaveURL(/\/shop$/);
  });

  test("keeps the /signin URL as a launcher for the shared popup", async ({ page }) => {
    await page.goto("/signin");

    const modal = page.getByTestId("signup-popup");
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-trigger", "explicit");
    await expect(page.getByTestId("button-google-signin")).toHaveCount(0);
  });

  test("opens explicit sign-in in the shared popup and dismisses it on mobile", async ({ page }) => {
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
            incentiveText: "Promotional copy",
            subtitleText: "Promotional subtitle",
            phoneSubtitleText: "Add your phone number to complete sign-up.",
            phoneRequired: true,
            consentText: "",
          },
        }),
      }),
    );
    await page.goto("/checkout");
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("show:signin-modal"));
    });

    const modal = page.getByTestId("signup-popup");
    const closeButton = page.getByTestId("btn-dismiss-nudge");

    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-trigger", "explicit");
    await expect(modal).toContainText("Sign in to TurtleLittle");
    await expect(modal).not.toContainText("Promotional copy");
    await expect(closeButton).toBeVisible();
    await expect(page.getByTestId("signin-modal")).toHaveCount(0);

    const box = await closeButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await closeButton.tap();
    await expect(modal).toBeHidden();
  });

  test("does not let a delayed promotional trigger take over explicit sign-in", async ({ page }) => {
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
            incentiveText: "Promotional copy",
            subtitleText: "Promotional subtitle",
            phoneSubtitleText: "Add your phone number to complete sign-up.",
            phoneRequired: true,
            consentText: "",
          },
        }),
      }),
    );
    await page.goto("/");
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("show:signin-modal"));
      window.dispatchEvent(new Event("cart:item-added-for-popup"));
    });

    const modal = page.getByTestId("signup-popup");
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute("data-trigger", "explicit");
    await expect(modal).toContainText("Sign in to TurtleLittle");
    await expect(modal).not.toContainText("Promotional copy");

    await page.getByTestId("btn-dismiss-nudge").click();
    await expect(modal).toBeHidden();
  });
});