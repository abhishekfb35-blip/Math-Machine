import { expect, test } from "@playwright/test";

test.describe("Sign-in popup close control", () => {
  test("is visible, touch-friendly, and dismisses the popup on mobile", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("show:signin-modal"));
    });

    const modal = page.getByTestId("signin-modal");
    const closeButton = page.getByTestId("signin-modal-close");

    await expect(modal).toBeVisible();
    await expect(closeButton).toBeVisible();

    const box = await closeButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await closeButton.tap();
    await expect(modal).toBeHidden();
  });
});