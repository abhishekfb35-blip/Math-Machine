import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const adminCheck = {
  authenticated: true,
  isSuperAdmin: false,
  permissions: ["catalog"],
};

test("admin can download the Meta catalog CSV from the catalog header", async ({ page }) => {
  let exportRequests = 0;
  const csv = [
    "id,title,description,availability,condition,price,link,image_link,brand,item_group_id",
    'p-1__variant,"Cotton towel","Soft, ""fluffy"" cotton",in stock,new,1200.00 INR,https://shop.example.test/product/cotton-towel,https://shop.example.test/images/towel.jpg,Example Brand,p-1',
  ].join("\r\n") + "\r\n";

  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(adminCheck),
  }));
  await page.route("**/api/admin/categories", route => route.fulfill({
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/products", route => route.fulfill({
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/attributes", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ audience: [], genders: [], themes: [], styles: [] }),
  }));
  await page.route("**/api/admin/tags", route => route.fulfill({
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/admin/tag-types", route => route.fulfill({
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/admin/catalog/meta-feed.csv", route => {
    exportRequests++;
    expect(route.request().method()).toBe("GET");
    return route.fulfill({
      contentType: "text/csv; charset=utf-8",
      headers: { "content-disposition": 'attachment; filename="meta-catalog.csv"' },
      body: csv,
    });
  });

  await page.goto("/admin/catalog");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-download-meta-catalog").click(),
  ]);

  expect(download.suggestedFilename()).toBe("meta-catalog.csv");
  expect(exportRequests).toBe(1);
  const contents = await readFile(await download.path()!, "utf8");
  expect(contents).toContain("item_group_id");
  expect(contents).toContain('"Cotton towel"');
});

test("Meta catalog export failures are shown to the admin", async ({ page }) => {
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(adminCheck),
  }));
  await page.route("**/api/admin/categories", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/products", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/attributes", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ audience: [], genders: [], themes: [], styles: [] }),
  }));
  await page.route("**/api/admin/tags", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/tag-types", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/catalog/meta-feed.csv", route => route.fulfill({
    status: 422,
    contentType: "application/json",
    body: JSON.stringify({ message: "Add a primary image to every active product before exporting." }),
  }));

  await page.goto("/admin/catalog");
  await page.getByTestId("button-download-meta-catalog").click();
  await expect(page.getByText("Meta catalog export failed")).toBeVisible();
  await expect(page.getByText("Add a primary image to every active product before exporting.")).toBeVisible();
});