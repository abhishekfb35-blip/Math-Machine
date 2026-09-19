/**
 * Mobile horizontal-overflow regression tests (375 px viewport).
 *
 * Each test navigates to a customer-facing page and asserts that
 * document.body.scrollWidth does not exceed window.innerWidth —
 * i.e. no sideways scroll exists.
 *
 * The WishlistSignupPrompt test also verifies the modal card itself
 * never overflows the viewport width.
 */

import { test, expect, type Page } from "@playwright/test";

// ─── helpers ────────────────────────────────────────────────────────────────

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
}

/** Returns the first product slug available from the API. */
async function getFirstProductSlug(page: Page): Promise<string> {
  const res = await page.request.get("/api/products?limit=1");
  const products = await res.json();
  if (!products?.length) throw new Error("No products available for testing");
  return products[0].slug as string;
}

/** Add a product to the cart so the /cart page is not empty. */
async function addProductToCart(page: Page): Promise<void> {
  const res = await page.request.get("/api/products?limit=1");
  const products = await res.json();
  if (!products?.length) return;
  await page.request.post("/api/cart/items", {
    data: { productId: products[0].id, quantity: 1 },
  });
}

// ─── test suite ─────────────────────────────────────────────────────────────

test.describe("Mobile – no horizontal scroll (375 px)", () => {
  // Override viewport to the canonical "real phone" width for all tests here
  test.use({ viewport: { width: 375, height: 812 } });

  // Allow a short time for any async layout effects to settle
  const waitForLayoutMs = 800;

  test("home page has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(waitForLayoutMs);
    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, "Home page has horizontal overflow (scrollWidth > innerWidth)").toBe(true);
  });

  test("shop page has no horizontal overflow", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForTimeout(waitForLayoutMs);
    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, "Shop page has horizontal overflow (scrollWidth > innerWidth)").toBe(true);
  });

  test("product page has no horizontal overflow", async ({ page }) => {
    const slug = await getFirstProductSlug(page);
    await page.goto(`/products/${slug}`);
    await page.waitForTimeout(waitForLayoutMs);
    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, `Product page (/products/${slug}) has horizontal overflow`).toBe(true);
  });

  test("cart page has no horizontal overflow", async ({ page }) => {
    await addProductToCart(page);
    await page.goto("/cart");
    await page.waitForTimeout(waitForLayoutMs);
    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, "Cart page has horizontal overflow (scrollWidth > innerWidth)").toBe(true);
  });

  test("checkout page has no horizontal overflow", async ({ page }) => {
    await addProductToCart(page);
    await page.goto("/checkout");
    await page.waitForTimeout(waitForLayoutMs);
    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, "Checkout page has horizontal overflow (scrollWidth > innerWidth)").toBe(true);
  });

  test("WishlistSignupPrompt stays within viewport width when open", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // Force the prompt to appear via the internal event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("wishlist:force-preview"));
    });

    // Wait for the prompt to render
    await page.waitForSelector('[data-testid="wishlist-signup-prompt"]', { timeout: 5000 });
    await page.waitForTimeout(300);

    // 1. The page itself must not have overflowed
    const pageNoOverflow = await hasNoHorizontalOverflow(page);
    expect(pageNoOverflow, "Page has horizontal overflow while WishlistSignupPrompt is open").toBe(true);

    // 2. The prompt card must not exceed the viewport width
    const cardFits = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="wishlist-signup-prompt"] > div:nth-child(2)') as HTMLElement | null;
      if (!card) return true; // if we can't find the inner card, skip
      const rect = card.getBoundingClientRect();
      return rect.right <= window.innerWidth && rect.left >= 0;
    });
    expect(cardFits, "WishlistSignupPrompt card overflows the viewport width").toBe(true);
  });

/** Fetch the configured engine thresholds from the API. */
async function getEngineThresholds(page: Page): Promise<{ wholesaleThreshold: number; retailFreeItemTrigger: number; retailBonusDiscountPct: number }> {
  const res = await page.request.get("/api/site-config/cart-engine-config");
  const defaults = { wholesaleThreshold: 5, retailFreeItemTrigger: 3, retailBonusDiscountPct: 30 };
  if (!res.ok()) return defaults;
  const body = await res.json();
  const v = body?.value ?? {};
  return {
    wholesaleThreshold: typeof v.wholesaleThreshold === "number" ? v.wholesaleThreshold : defaults.wholesaleThreshold,
    retailFreeItemTrigger: typeof v.retailFreeItemTrigger === "number" ? v.retailFreeItemTrigger : defaults.retailFreeItemTrigger,
    retailBonusDiscountPct: typeof v.retailBonusDiscountPct === "number" ? v.retailBonusDiscountPct : defaults.retailBonusDiscountPct,
  };
}

/** Assert that all nudge-node elements have their bounding boxes inside the viewport. */
async function assertNudgeNodesInViewport(page: Page, context: string) {
  const result = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-testid^="nudge-node-"]'));
    const vw = window.innerWidth;
    const overflowing = nodes
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { id: el.getAttribute("data-testid"), left: Math.round(rect.left), right: Math.round(rect.right) };
      })
      .filter((r) => r.right > vw || r.left < 0);
    return { overflowing, nodeCount: nodes.length, vw };
  });

  expect(result.nodeCount, `${context}: expected NudgeCard nodes to be rendered`).toBeGreaterThan(0);
  expect(
    result.overflowing,
    `${context}: NudgeCard nodes exceed viewport (${result.vw}px): ${JSON.stringify(result.overflowing)}`,
  ).toHaveLength(0);
}

  test("NudgeCard reward tracker: all nodes visible within viewport at 1-item cart (configured threshold)", async ({ page }) => {
    // Resolve the live threshold before building the cart
    const { wholesaleThreshold } = await getEngineThresholds(page);

    // Add exactly 1 item — the NudgeCard should show the "early progress" state
    await addProductToCart(page);
    await page.goto("/cart");
    await page.waitForTimeout(waitForLayoutMs);

    await page.waitForSelector('[data-testid="nudge-card"]', { timeout: 5000 });
    await assertNudgeNodesInViewport(page, `1-item cart (threshold=${wholesaleThreshold})`);
    await expect(page.getByTestId("nudge-track")).toHaveAttribute("data-sequence-item-count", "1");

    const completedCart = page.getByTestId("nudge-cart-1");
    await expect(completedCart).not.toHaveClass(/cart-stroke-dashed/);
    await expect(completedCart).toHaveClass(/fill-amber-500/);
    await expect(page.getByTestId("nudge-cart-2")).toHaveClass(/nudge-active-pulse/);

    for (let pos = 2; pos <= wholesaleThreshold; pos += 1) {
      await expect(page.getByTestId(`nudge-cart-${pos}`)).toHaveClass(/cart-stroke-dashed/);
    }

    const animationTiming = await page.evaluate((finalPos) => {
      const active = document.querySelector('[data-testid="nudge-cart-2"]');
      const final = document.querySelector(`[data-testid="nudge-cart-wrap-${finalPos}"]`);
      if (!active || !final) return null;

      const activeStyle = getComputedStyle(active);
      const finalStyle = getComputedStyle(final);
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        configuredCycle: rootStyle.getPropertyValue("--nudge-animation-cycle").trim(),
        configuredPhaseDelay: rootStyle.getPropertyValue("--nudge-animation-phase-delay").trim(),
        activeAnimation: activeStyle.animationName,
        activeDuration: activeStyle.animationDuration,
        activeDelay: activeStyle.animationDelay,
        finalAnimation: finalStyle.animationName,
        finalDuration: finalStyle.animationDuration,
        finalDelay: finalStyle.animationDelay,
      };
    }, wholesaleThreshold);

    expect(animationTiming).not.toBeNull();
    expect(animationTiming).toMatchObject({
      configuredCycle: "12s",
      configuredPhaseDelay: "3s",
      activeAnimation: "nudgeActivePulse",
      activeDelay: "0s",
      finalAnimation: "nudgeBlink",
    });
    expect(animationTiming!.activeDuration).toBe(animationTiming!.configuredCycle);
    expect(animationTiming!.finalDuration).toBe(animationTiming!.configuredCycle);
    expect(animationTiming!.finalDelay).toBe(animationTiming!.configuredPhaseDelay);

    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, "Cart page has horizontal overflow with NudgeCard visible (1 item)").toBe(true);
  });

  test("NudgeCard reward tracker: all nodes visible within viewport at wholesale-threshold cart (configured threshold)", async ({ page }) => {
    // Read the configured wholesale threshold from the live API
    const { wholesaleThreshold } = await getEngineThresholds(page);

    // Fetch enough distinct products (or reuse the same product with higher quantity)
    const productsRes = await page.request.get(`/api/products?limit=${wholesaleThreshold}`);
    const products = await productsRes.json();

    if (products.length >= wholesaleThreshold) {
      // Add one of each product up to the threshold
      for (const p of products.slice(0, wholesaleThreshold)) {
        await page.request.post("/api/cart/items", { data: { productId: p.id, quantity: 1 } });
      }
    } else {
      // Fewer distinct products than threshold — add one product with enough quantity
      await page.request.post("/api/cart/items", {
        data: { productId: products[0].id, quantity: wholesaleThreshold },
      });
    }

    await page.goto("/cart");
    await page.waitForTimeout(waitForLayoutMs);

    await page.waitForSelector('[data-testid="nudge-card"]', { timeout: 5000 });

    // Confirm we are actually at or past the wholesale threshold
    const cartRes = await page.request.get("/api/cart");
    const cart = await cartRes.json();
    expect(cart.itemCount, `Expected cart to have at least ${wholesaleThreshold} items (wholesale state)`).toBeGreaterThanOrEqual(wholesaleThreshold);

    await assertNudgeNodesInViewport(page, `wholesale-threshold cart (threshold=${wholesaleThreshold})`);
    await expect(page.getByTestId("nudge-track")).toHaveAttribute(
      "data-sequence-item-count",
      String(wholesaleThreshold),
    );

    for (let pos = 1; pos <= wholesaleThreshold; pos += 1) {
      const completedCart = page.getByTestId(`nudge-cart-${pos}`);
      await expect(completedCart).not.toHaveClass(/cart-stroke-dashed/);
      await expect(completedCart).toHaveClass(/fill-amber-500/);
    }

    await expect(page.getByTestId(`nudge-cart-wrap-${wholesaleThreshold}`)).toHaveClass(/nudge-blink/);

    const noOverflow = await hasNoHorizontalOverflow(page);
    expect(noOverflow, `Cart page has horizontal overflow at wholesale threshold (${wholesaleThreshold} items)`).toBe(true);
  });

  test("NudgeCard reward tracker: rapid cart changes restart alternating animations without overlap", async ({ page }) => {
    const { wholesaleThreshold } = await getEngineThresholds(page);
    expect(
      wholesaleThreshold,
      "Alternating animation test needs at least one future stage after the updated cart count",
    ).toBeGreaterThan(2);

    await addProductToCart(page);
    await page.goto("/cart");
    await page.waitForSelector('[data-testid="nudge-card"]', { timeout: 5000 });

    const targetCount = Math.min(3, wholesaleThreshold - 1);
    const increaseButton = page.locator('[data-testid^="button-increase-qty-"]').first();
    const quantity = page.locator('[data-testid^="text-qty-"]').first();

    for (let nextCount = 2; nextCount <= targetCount; nextCount += 1) {
      await increaseButton.click();
      await expect(quantity).toHaveText(String(nextCount));
      await expect(page.getByTestId("nudge-track")).toHaveAttribute(
        "data-sequence-item-count",
        String(nextCount),
      );
    }

    const activePos = targetCount + 1;
    const finalPos = wholesaleThreshold;

    await page.waitForFunction(
      ({ activePos, finalPos }) => {
        const active = document.querySelector(`[data-testid="nudge-cart-${activePos}"]`);
        const final = document.querySelector(`[data-testid="nudge-cart-wrap-${finalPos}"]`);
        if (!active || !final) return false;

        const shadow = getComputedStyle(active).boxShadow;
        const alphaMatch = shadow.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
        const shadowAlpha = alphaMatch ? Number(alphaMatch[1]) : 0;
        const finalOpacity = Number(getComputedStyle(final).opacity);

        return shadowAlpha > 0.1 && finalOpacity > 0.99;
      },
      { activePos, finalPos },
      { timeout: 2000 },
    );

    await page.waitForFunction(
      ({ activePos, finalPos }) => {
        const active = document.querySelector(`[data-testid="nudge-cart-${activePos}"]`);
        const final = document.querySelector(`[data-testid="nudge-cart-wrap-${finalPos}"]`);
        if (!active || !final) return false;

        const shadow = getComputedStyle(active).boxShadow;
        const alphaMatch = shadow.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
        const shadowAlpha = alphaMatch ? Number(alphaMatch[1]) : 0;
        const finalOpacity = Number(getComputedStyle(final).opacity);

        return shadowAlpha <= 0.01 && finalOpacity < 0.5;
      },
      { activePos, finalPos },
      { timeout: 5000 },
    );
  });
});
