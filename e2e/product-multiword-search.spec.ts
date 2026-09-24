import { test, expect } from "@playwright/test";
import type { Request, Response } from "express";
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