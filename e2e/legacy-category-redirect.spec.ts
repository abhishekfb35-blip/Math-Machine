import { expect, test } from "@playwright/test";

test.describe("legacy kids bath towels URL", () => {
  test("permanently redirects direct visits to the tagged Shop view", async ({ request }) => {
    const response = await request.get("/category/kids-bath-towels", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe("/shop?tag=kids-towels");
  });

  test("redirects client-side navigation and loads the tag view", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.history.pushState({}, "", "/category/kids-bath-towels");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expect(page).toHaveURL(/\/shop\?tag=kids-towels$/);
    await expect(page.getByTestId("text-tag-view-heading")).toContainText("Kids Towels");
  });
});