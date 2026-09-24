import { test, expect } from "@playwright/test";
import { storage } from "../server/storage";

test("storefront search finds titles when query words are separated", async ({ page, request }) => {
  const response = await request.get("/api/products/search?q=kids%20towel");
  expect(response.ok()).toBeTruthy();

  const results: Array<{ id: string; name: string }> = await response.json();
  const separatedTitle = results.find(product => {
    const name = product.name.toLowerCase();
    return name.includes("kids") && name.includes("towel") && !name.includes("kids towel");
  });
  expect(separatedTitle, "Expected a title such as “Kids Bath Towel” in the search results").toBeTruthy();
  const adminResults = await storage.searchAllProducts("kids towel");
  expect(adminResults.some(product => product.id === separatedTitle!.id)).toBe(true);

  await page.goto("/shop?q=kids%20towel");
  await expect(page.getByTestId(`text-product-name-${separatedTitle!.id}`)).toBeVisible();
});

test("admin and customer searches find singular titles for plural query words", async ({ page, request }) => {
  const query = "kids initials towels";
  const adminResults = await storage.searchAllProducts(query);
  const singularTitle = adminResults.find(product =>
    product.active && /\bkid\b/i.test(product.name) && /\btowel\b/i.test(product.name),
  );
  expect(singularTitle, "Expected the singular Kid's Bath Towel in admin results").toBeTruthy();

  const response = await request.get(`/api/products/search?q=${encodeURIComponent(query)}`);
  expect(response.ok()).toBeTruthy();
  const customerResults: Array<{ id: string }> = await response.json();
  expect(customerResults.some(product => product.id === singularTitle!.id)).toBe(true);

  await page.goto(`/shop?q=${encodeURIComponent(query)}`);
  await expect(page.getByTestId(`text-product-name-${singularTitle!.id}`)).toBeVisible();
});