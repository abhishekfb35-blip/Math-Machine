import { test, expect } from "@playwright/test";

test("storefront search finds titles when query words are separated", async ({ page, request }) => {
  const response = await request.get("/api/products/search?q=kids%20towel");
  expect(response.ok()).toBeTruthy();

  const results: Array<{ id: string; name: string }> = await response.json();
  const separatedTitle = results.find(product => {
    const name = product.name.toLowerCase();
    return name.includes("kids") && name.includes("towel") && !name.includes("kids towel");
  });
  expect(separatedTitle, "Expected a title such as “Kids Bath Towel” in the search results").toBeTruthy();

  await page.goto("/shop?q=kids%20towel");
  await expect(page.getByTestId(`text-product-name-${separatedTitle!.id}`)).toBeVisible();
});