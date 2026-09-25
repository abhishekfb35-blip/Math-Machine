import { test, expect } from "@playwright/test";
import type { Request, Response } from "express";
import { storage } from "../server/storage";
import { searchAdminProducts } from "../server/routes/admin/catalog";

type SearchProduct = { id: string; name: string; active: boolean };

async function adminSearch(query: string): Promise<SearchProduct[]> {
  let results: SearchProduct[] | undefined;
  await searchAdminProducts(
    { query: { q: query } } as unknown as Request,
    {
      json(products: SearchProduct[]) {
        results = products;
        return this;
      },
    } as unknown as Response,
  );
  if (!results) throw new Error("Admin search handler did not respond");
  return results;
}

test("storefront search finds titles when query words are separated", async ({ page, request }) => {
  const response = await request.get("/api/products/search?q=kids%20towel");
  expect(response.ok()).toBeTruthy();

  const results: Array<{ id: string; name: string }> = await response.json();
  const separatedTitle = results.find(product => {
    const name = product.name.toLowerCase();
    return name.includes("kids") && name.includes("towel") && !name.includes("kids towel");
  });
  expect(separatedTitle, "Expected a title such as “Kids Bath Towel” in the search results").toBeTruthy();
  const adminResults = await adminSearch("kids towel");
  expect(adminResults.some(product => product.id === separatedTitle!.id)).toBe(true);

  await page.goto("/shop?q=kids%20towel");
  await expect(page.getByTestId(`text-product-name-${separatedTitle!.id}`)).toBeVisible();
});

test("admin and customer searches find singular titles for plural query words", async ({ page, request }) => {
  const query = "kids initials towels";
  const adminResults = await adminSearch(query);
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

test("admin catalog screen renders separated and singular/plural search results", async ({ page }) => {
  const separatedTitle = (await adminSearch("kids towel")).find(product =>
    /\bkids\b/i.test(product.name) && /\btowel\b/i.test(product.name) && !/kids towel/i.test(product.name),
  );
  const singularTitle = (await adminSearch("kids initials towels")).find(product =>
    /\bkid\b/i.test(product.name) && /\btowel\b/i.test(product.name),
  );
  expect(separatedTitle).toBeTruthy();
  expect(singularTitle).toBeTruthy();

  await page.route("**/api/admin/check", route => route.fulfill({
    json: { authenticated: true, isSuperAdmin: false, permissions: ["catalog"] },
  }));
  await page.route(/\/api\/admin\/(categories|tags|tag-types)$/, route => route.fulfill({ json: [] }));
  const requestedQueries: string[] = [];
  await page.route(/\/api\/admin\/products\/search(?:\?|$)/, async route => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    requestedQueries.push(query);
    await route.fulfill({ json: await adminSearch(query) });
  });

  await page.goto("/admin/catalog");
  const input = page.getByTestId("input-admin-search");
  await expect(input).toBeVisible();

  await input.fill("kids towel");
  await expect(page.getByTestId(`card-search-product-${separatedTitle!.id}`)).toBeVisible();

  await input.fill("kids initials towels");
  await expect(page.getByTestId(`card-search-product-${singularTitle!.id}`)).toBeVisible();

  await input.fill("kid towel");
  await expect(page.getByTestId(`card-search-product-${separatedTitle!.id}`)).toBeVisible();
  expect(requestedQueries).toEqual(expect.arrayContaining(["kids towel", "kids initials towels", "kid towel"]));
});

test("category product filter matches separated words and singular/plural forms", async ({ page }) => {
  const separatedTitle = (await storage.searchAllProducts("kids towel")).find(product =>
    product.active && /\bkids\b/i.test(product.name) && /\btowel\b/i.test(product.name) && !/kids towel/i.test(product.name),
  );
  const singularTitle = (await storage.searchAllProducts("kids initials towels")).find(product =>
    product.active && /\bkid\b/i.test(product.name) && /\btowel\b/i.test(product.name),
  );
  expect(separatedTitle).toBeTruthy();
  expect(singularTitle).toBeTruthy();
  expect(singularTitle!.categoryId).toBe(separatedTitle!.categoryId);

  const category = (await storage.getCategories()).find(item => item.id === separatedTitle!.categoryId);
  expect(category).toBeTruthy();
  const categoryProducts = await storage.getAllProductsByCategory(category!.id);
  const displayProducts = categoryProducts.filter(product =>
    product.id === separatedTitle!.id || product.id === singularTitle!.id,
  );
  expect(displayProducts).toHaveLength(2);

  await page.route("**/api/admin/check", route => route.fulfill({
    json: { authenticated: true, isSuperAdmin: false, permissions: ["catalog"] },
  }));
  await page.route("**/api/admin/categories", route => route.fulfill({ json: [category] }));
  await page.route("**/api/admin/tags", route => route.fulfill({ json: [] }));
  await page.route("**/api/admin/tag-types", route => route.fulfill({ json: [] }));
  await page.route("**/api/admin/product-updates/stream", route => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "",
  }));
  await page.route(`**/api/admin/catalog/category/${category!.id}`, route => route.fulfill({
    json: { products: displayProducts, productTagMap: {}, productImages: {} },
  }));

  await page.goto("/admin/catalog");
  await page.getByTestId(`text-category-name-${category!.id}`).click();
  const filter = page.getByTestId("input-category-filter");
  await expect(filter).toBeVisible();

  await filter.fill("kids towel");
  await expect(page.getByTestId(`card-product-${separatedTitle!.id}`)).toBeVisible();
  await expect(page.getByTestId(`card-product-${singularTitle!.id}`)).toBeVisible();

  await filter.fill("kids towels");
  await expect(page.getByTestId(`card-product-${singularTitle!.id}`)).toBeVisible();

  await filter.fill("kid towel");
  await expect(page.getByTestId(`card-product-${separatedTitle!.id}`)).toBeVisible();
});

test("product details display the stored description that matched a Shop search", async ({ page }) => {
  const product = (await storage.getProducts()).find(item =>
    /star fish/i.test(item.description ?? "") && !/\bfish\b/i.test(item.name),
  );
  expect(product, "Expected an existing product whose description mentions Star Fish but title does not").toBeTruthy();

  await page.goto(`/product/${product!.slug}`);
  const description = page.getByTestId("text-product-description");
  await expect(description).toBeVisible();
  await expect(description).toContainText("Star Fish");
  await expect(page.getByTestId("text-product-name")).toHaveText(product!.name);
  expect(await description.evaluate(element => window.getComputedStyle(element).whiteSpace)).toBe("pre-line");
  expect(await description.evaluate(element => element.textContent)).toBe(product!.description);
});