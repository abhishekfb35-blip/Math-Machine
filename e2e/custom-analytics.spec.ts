import { expect, test } from "@playwright/test";

test.describe("privacy-safe storefront analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__customAnalyticsEvents = [];
      (window as any).umami = {
        track(name: string, data?: Record<string, string | number | boolean>) {
          (window as any).__customAnalyticsEvents.push({ name, data });
        },
      };
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
      });
    });
  });

  test("tracks a committed search without sending its text", async ({ page }) => {
    const privateSearchText = "private search phrase";
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const search = page.getByTestId("input-search-products");
    await search.fill(privateSearchText);

    expect(await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "filter_applied",
      ),
    )).toHaveLength(0);

    await search.press("Enter");

    await expect.poll(() => page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "filter_applied",
      ).length,
    )).toBe(1);
    const [event] = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (entry: { name: string }) => entry.name === "filter_applied",
      ),
    );

    expect(event.name).toBe("filter_applied");
    expect(event.data).toMatchObject({
      filter_type: "search",
      has_search: true,
      query_length: privateSearchText.length,
    });
    expect(JSON.stringify(event)).not.toContain(privateSearchText);
  });

  test("tracks product selection and successful guest wishlist changes", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const card = page.locator('[data-testid^="card-product-"]').first();
    await expect(card).toBeVisible();
    const productId = (await card.getAttribute("data-testid"))!.replace("card-product-", "");
    const wishlistButton = page.getByTestId(`button-wishlist-${productId}`);

    await wishlistButton.click();
    await wishlistButton.click();

    const wishlistEvents = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name.startsWith("wishlist_item_"),
      ),
    );
    expect(wishlistEvents).toEqual([
      {
        name: "wishlist_item_added",
        data: {
          product_id: productId,
          authenticated: false,
          source: "product_card",
        },
      },
      {
        name: "wishlist_item_removed",
        data: {
          product_id: productId,
          authenticated: false,
          source: "product_card",
        },
      },
    ]);

    await card.locator(`[data-testid="img-product-${productId}"]`).click();
    await expect(page).toHaveURL(/\/product\//);

    const [selectionEvent] = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (event: { name: string }) => event.name === "product_selected",
      ),
    );
    expect(selectionEvent).toEqual({
      name: "product_selected",
      data: {
        product_id: productId,
        placement: "shop",
      },
    });
  });

  test("tracks a completed share without sending share content", async ({ page }) => {
    const productsResponse = await page.request.get("/api/products?limit=1");
    expect(productsResponse.ok()).toBeTruthy();
    const [product] = await productsResponse.json();
    expect(product?.slug).toBeTruthy();

    await page.goto(`/product/${product.slug}`);
    const shareButton = page.getByRole("main").getByTestId("button-share");
    await expect(shareButton).toBeVisible();

    await shareButton.click();
    const whatsapp = page.getByTestId("share-option-whatsapp");
    await whatsapp.evaluate(element => {
      element.addEventListener("click", event => event.preventDefault());
    });
    await whatsapp.click();

    const [event] = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (entry: { name: string }) => entry.name === "share_completed",
      ),
    );
    expect(event).toEqual({
      name: "share_completed",
      data: {
        surface: "product",
        method: "whatsapp",
      },
    });
    expect(Object.keys(event.data)).toEqual(["surface", "method"]);
  });

  test("tracks curated section entry and exit without sending its label", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const sectionLink = page.locator('[data-testid^="link-see-all-"]').first();
    await expect(sectionLink).toBeVisible();
    const sectionLabel = (await sectionLink.getAttribute("data-testid"))!.replace("link-see-all-", "");
    await sectionLink.click();
    await expect(page.getByTestId("button-back-to-all")).toBeVisible();

    await page.getByTestId("button-back-to-all").click();

    const events = await page.evaluate(() =>
      (window as any).__customAnalyticsEvents.filter(
        (entry: { name: string; data?: { filter_type?: string } }) =>
          entry.name === "filter_applied" && entry.data?.filter_type === "section",
      ),
    );
    expect(events).toHaveLength(2);
    expect(events[0].data).toMatchObject({
      filter_type: "section",
      has_section: true,
    });
    expect(events[1].data).toMatchObject({
      filter_type: "section",
      has_section: false,
    });
    expect(JSON.stringify(events)).not.toContain(sectionLabel);
  });
});