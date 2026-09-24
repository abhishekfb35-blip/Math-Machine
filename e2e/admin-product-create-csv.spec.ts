import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const required = "sku,name,slug,price,category_id";
const check = {
  authenticated: true, isSuperAdmin: false, permissions: ["catalog"],
};

test("admin downloads template, previews multiline bullets and defaults, then creates new products", async ({ page }) => {
  let submits = 0;
  let catalogLoads = 0;
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(check),
  }));
  await page.route("**/api/admin/categories", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify([{ id: "cat-1", name: "Towels", slug: "towels", sortOrder: 1 }]),
  }));
  await page.route("**/api/admin/products", route => {
    catalogLoads++;
    return route.fulfill({
      contentType: "application/json", body: JSON.stringify([{ sku: "EXISTING", slug: "existing" }]),
    });
  });
  await page.route("**/api/admin/products/import-new", route => {
    submits++;
    const data = route.request().postDataJSON();
    expect(data.rows).toEqual([{
      sku: "NEW-1", name: "New Towel", slug: "new-towel", price: 999, categoryId: "cat-1",
      material: "100% cotton", gsm: 500, bulletPoints: ['Soft, "fluffy" cotton', "Easy care"],
    }]);
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ createdProducts: 1 }) });
  });

  await page.goto("/admin/catalog");
  await expect(page.getByTestId("button-open-image-csv")).toBeVisible();
  await page.getByTestId("button-open-product-create-csv").click();
  await expect(page.getByTestId("dialog-product-create-csv")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-download-product-csv").click(),
  ]);
  expect(download.suggestedFilename()).toBe("new-products-template.csv");
  const template = await readFile(await download.path()!, "utf8");
  expect(template).toContain("sku,name,slug,price,category_id");
  expect(template).toContain("bullet_points");
  expect(template).not.toContain("wholesale_price");
  expect(template).not.toContain("amazon_asin");

  const upload = (content: string) => page.getByTestId("input-product-create-csv").setInputFiles({
    name: "new-products.csv", mimeType: "text/csv", buffer: Buffer.from(content),
  });
  await upload(`${required}\nEXISTING,Old,old,999,cat-1\nNEW-2,Other,other,900,missing`);
  await expect(page.getByTestId("product-create-row-0")).toContainText("Already exists");
  await expect(page.getByTestId("product-create-row-1")).toContainText("Category not found");
  await expect(page.getByTestId("button-apply-product-create-csv")).toBeDisabled();
  expect(submits).toBe(0);

  await upload(`${required},bullet_points,material,gsm\nNEW-1,New Towel,new-towel,999,cat-1,"Soft, ""fluffy"" cotton\nEasy care",,`);
  const row = page.getByTestId("product-create-row-0");
  await expect(row).toContainText("100% cotton");
  await expect(row).toContainText("500");
  await expect(row).toContainText("Soft, \"fluffy\" cotton");
  await expect(row).toContainText("Easy care");
  await expect(row).toContainText("Ready");
  await page.getByTestId("button-apply-product-create-csv").click();
  await expect(page.getByTestId("product-create-result")).toContainText("Created 1 product");
  expect(submits).toBe(1);
  expect(catalogLoads).toBeGreaterThan(1);
});

test("server errors after multiline cells show physical CSV lines without clearing preview", async ({ page }) => {
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(check),
  }));
  await page.route("**/api/admin/categories", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify([{ id: "cat-1", name: "Towels" }]),
  }));
  await page.route("**/api/admin/products", route => route.fulfill({
    contentType: "application/json", body: "[]",
  }));
  await page.route("**/api/admin/products/import-new", route => route.fulfill({
    status: 400, contentType: "application/json",
    body: JSON.stringify({ message: "Conflict", errors: [{ row: 3, message: "SKU already exists" }] }),
  }));
  await page.goto("/admin/catalog");
  await page.getByTestId("button-open-product-create-csv").click();
  await page.getByTestId("input-product-create-csv").setInputFiles({
    name: "new-products.csv", mimeType: "text/csv",
    buffer: Buffer.from(`${required},bullet_points\nNEW-1,Towel,one,100,cat-1,"First\nSecond"\nNEW-2,Towel,two,100,cat-1,`),
  });
  await expect(page.getByTestId("button-apply-product-create-csv")).toBeEnabled();
  await page.getByTestId("button-apply-product-create-csv").click();
  await expect(page.getByTestId("product-create-server-errors")).toContainText("Line 4: SKU already exists");
  await expect(page.getByTestId("product-create-preview")).toBeVisible();
});

test("new product import requires admin access", async ({ request }) => {
  const response = await request.post("/api/admin/products/import-new", {
    data: { rows: [{ sku: "a", name: "A", slug: "a", price: 100, categoryId: "missing" }] },
  });
  // Misconfigured credentials must fail closed rather than inheriting the
  // older admin middleware's permissive fallback.
  expect([401, 503]).toContain(response.status());
});