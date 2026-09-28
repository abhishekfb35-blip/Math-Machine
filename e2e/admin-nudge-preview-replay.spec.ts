import { expect, test } from "@playwright/test";

test("admin can replay the nudge preview without saving configuration", async ({ page }) => {
  let configSaveRequests = 0;

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path.startsWith("/api/site-config/")) {
      configSaveRequests += 1;
    }
  });

  await page.route("**/api/admin/check", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        isSuperAdmin: false,
        permissions: ["offers"],
      }),
    });
  });

  await page.route("**/api/site-config", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        "cart-engine-config": {
          wholesaleThreshold: 5,
          retailFreeItemTrigger: 3,
          retailBonusDiscountPct: 30,
        },
        "delivery-tiers": [],
        "payment-methods": { codEnabled: true },
      }),
    });
  });

  await page.goto("/admin/offers");

  const previewGrid = page.getByTestId("nudge-preview-grid");
  const replayButton = page.getByTestId("button-replay-nudge-preview");
  const activeCart = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-2");
  const activeCartWrap = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-wrap-2");
  const earlierCartWrap = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-wrap-4");
  const incompleteWholesaleCartWrap = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-wrap-5");
  const incompleteWholesaleLabel = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-node-5")
    .locator("span.nudge-wholesale-halo");
  const unlockedWholesaleCartWrap = page
    .getByTestId("nudge-preview-wholesale")
    .getByTestId("nudge-cart-wrap-5");
  const unlockedWholesaleLabel = page
    .getByTestId("nudge-preview-wholesale")
    .getByTestId("nudge-node-5")
    .locator("span.nudge-wholesale-halo");

  await expect(previewGrid).toHaveAttribute("data-replay-key", "0");
  await expect(replayButton).toBeVisible();
  await expect(activeCart).toHaveClass(/nudge-active-pulse/);
  await expect(activeCartWrap).not.toHaveClass(/nudge-wholesale-halo/);
  await expect(earlierCartWrap).not.toHaveClass(/nudge-wholesale-halo/);
  await expect(incompleteWholesaleCartWrap).toHaveClass(/nudge-blink/);
  await expect(incompleteWholesaleCartWrap).toHaveClass(/nudge-wholesale-halo/);
  await expect
    .poll(() =>
      incompleteWholesaleCartWrap.evaluate((element) =>
        getComputedStyle(element, "::after").animationName,
      ),
    )
    .toBe("nudgeWholesaleHalo");
  await expect(incompleteWholesaleLabel).toBeVisible();
  await expect(unlockedWholesaleCartWrap).not.toHaveClass(/nudge-wholesale-halo/);
  await expect(unlockedWholesaleLabel).toHaveCount(0);
  await expect
    .poll(() =>
      activeCart.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--nudge-active-pulse-rgb").trim(),
      ),
    )
    .toBe("6, 182, 212");

  await page.waitForTimeout(750);
  const elapsedBeforeReplay = await activeCart.evaluate((element) => {
    return element.getAnimations()[0]?.currentTime ?? 0;
  });
  expect(Number(elapsedBeforeReplay)).toBeGreaterThan(500);

  await replayButton.click();
  await expect(previewGrid).toHaveAttribute("data-replay-key", "1");

  const elapsedAfterReplay = await activeCart.evaluate((element) => {
    return element.getAnimations()[0]?.currentTime ?? 0;
  });
  expect(Number(elapsedAfterReplay)).toBeLessThan(500);
  expect(configSaveRequests).toBe(0);
});