import { expect, test } from "@playwright/test";

const columns = "product_id,image_url,image_sequence_number";

test("admin previews errors, then imports valid CSV images and refreshes the catalog", async ({ page }) => {
  let submissions = 0;
  let productRequests = 0;
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, isSuperAdmin: false, permissions: ["catalog"] }),
  }));
  await page.route("**/api/admin/products", route => {
    productRequests++;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify([{ id: "known-product" }]) });
  });
  await page.route("**/api/admin/products/import-image-urls", route => {
    submissions++;
    expect(route.request().postDataJSON()).toEqual({
      rows: [{ productId: "known-product", imageUrl: "https://example.com/gallery.jpg", imageSequenceNumber: 2 }],
    });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ updatedRows: 1, updatedProducts: 1 }) });
  });

  await page.goto("/admin/catalog");
  await page.getByTestId("button-open-image-csv").click();
  await expect(page.getByTestId("dialog-image-csv-import")).toBeVisible();
  await expect(page.getByTestId("button-download-image-csv")).toBeVisible();
  const upload = async (text: string) => page.getByTestId("input-image-csv-file").setInputFiles({
    name: "gallery.csv", mimeType: "text/csv", buffer: Buffer.from(text),
  });
  await upload(`${columns}\nknown-product,https://example.com/gallery.jpg,1\nunknown,/images/other.jpg,2`);
  await expect(page.getByTestId("image-csv-row-0")).toContainText("2 or greater");
  await expect(page.getByTestId("image-csv-row-1")).toContainText("not found");
  await expect(page.getByTestId("button-apply-image-csv")).toBeDisabled();
  expect(submissions).toBe(0);

  await upload(`${columns}\nknown-product,https://example.com/gallery.jpg,2`);
  await expect(page.getByTestId("image-csv-row-0")).toContainText("Ready");
  await page.getByTestId("button-apply-image-csv").click();
  await expect(page.getByTestId("image-csv-result")).toContainText("Updated 1 image on 1 product");
  expect(submissions).toBe(1);
  expect(productRequests).toBeGreaterThan(1);
});

test("image CSV endpoint requires admin catalog access when authentication is configured", async ({ request }) => {
  test.skip(!process.env.ADMIN_USERNAME || !(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH),
    "Requires configured admin authentication");
  const response = await request.post("/api/admin/products/import-image-urls", {
    data: { rows: [{ productId: "unknown", imageUrl: "/images/test.jpg", imageSequenceNumber: 2 }] },
  });
  expect(response.status()).toBe(401);
});

test("server validation errors identify the correct line after a quoted multiline cell", async ({ page }) => {
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, isSuperAdmin: false, permissions: ["catalog"] }),
  }));
  await page.route("**/api/admin/products", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ id: "p1" }, { id: "p2" }]),
  }));
  await page.route("**/api/admin/products/import-image-urls", route => route.fulfill({
    status: 400, contentType: "application/json",
    body: JSON.stringify({ message: "Validation failed", errors: [{ row: 3, message: "Product was removed" }] }),
  }));
  await page.goto("/admin/catalog");
  await page.getByTestId("button-open-image-csv").click();
  await page.getByTestId("input-image-csv-file").setInputFiles({
    name: "gallery.csv", mimeType: "text/csv",
    buffer: Buffer.from(`${columns}\np1,"https://example.com/a\nb.jpg",2\np2,/images/test.jpg,3`),
  });
  await expect(page.getByTestId("button-apply-image-csv")).toBeEnabled();
  await page.getByTestId("button-apply-image-csv").click();
  await expect(page.getByTestId("image-csv-server-errors")).toContainText("Line 4: Product was removed");
});