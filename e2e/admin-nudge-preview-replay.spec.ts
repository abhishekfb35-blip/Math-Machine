import { expect, test, type Page } from "@playwright/test";

async function openOffersPage(page: Page) {
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
}

test("admin can replay the nudge preview without saving configuration", async ({ page }) => {
  let configSaveRequests = 0;

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path.startsWith("/api/site-config/")) {
      configSaveRequests += 1;
    }
  });

  await openOffersPage(page);

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
  await page.addStyleTag({
    content: ".nudge-wholesale-halo::after { animation: none !important; }",
  });
  const restingHalo = await incompleteWholesaleCartWrap.evaluate((element) =>
    getComputedStyle(element, "::after").boxShadow,
  );
  expect(restingHalo).toContain("0.3");
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

test("nudge preview keeps distinct pulse and stage-five halo colors in dark mode", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await openOffersPage(page);

  await expect(page.locator("html")).toHaveClass(/dark/);

  const activeCart = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-2");
  const incompleteWholesaleCartWrap = page
    .getByTestId("nudge-preview-state1")
    .getByTestId("nudge-cart-wrap-5");

  await expect(activeCart).toHaveClass(/nudge-active-pulse/);
  await expect(incompleteWholesaleCartWrap).toHaveClass(/nudge-wholesale-halo/);
  await expect
    .poll(() => activeCart.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("nudgeActivePulse");
  await expect
    .poll(() =>
      incompleteWholesaleCartWrap.evaluate((element) =>
        getComputedStyle(element, "::after").animationName,
      ),
    )
    .toBe("nudgeWholesaleHalo");

  const pulse = await activeCart.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.getPropertyValue("--nudge-active-pulse-rgb").trim(),
      duration: style.animationDuration,
      delay: style.animationDelay,
    };
  });
  const halo = await incompleteWholesaleCartWrap.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return {
      color: style.getPropertyValue("--nudge-wholesale-halo-rgb").trim(),
      duration: style.animationDuration,
      delay: style.animationDelay,
    };
  });

  expect(pulse.color).toBe("34, 211, 238");
  expect(halo.color).toBe("103, 232, 249");
  expect(pulse.color).not.toBe(halo.color);
  expect(pulse.duration).toBe("6s");
  expect(pulse.delay).toBe("0s");
  expect(halo.duration).toBe("6s");
  expect(halo.delay).toBe("3s");
});