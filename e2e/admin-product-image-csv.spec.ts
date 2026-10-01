import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ addedRows: 1, addedProducts: 1 }) });
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
  await expect(page.getByTestId("image-csv-result")).toContainText("Added 1 image to 1 product");
  expect(submissions).toBe(1);
  expect(productRequests).toBeGreaterThan(1);
});

test("admin previews local-folder image targets and reports occupied slots without changing them", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/admin/check", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, isSuperAdmin: false, permissions: ["catalog"] }),
  }));
  await page.route("**/api/admin/products", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ id: "known-product" }]),
  }));
  await page.route("**/api/admin/products/import-image-files", route => {
    submissions++;
    const requestBody = route.request().postData() ?? "";
    expect(requestBody).toContain("imageSequenceNumber");
    expect(requestBody).toContain("known-product.jpg");
    if (submissions === 1) {
      expect(requestBody).toContain("4");
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Image import validation failed",
          errors: [{ row: 2, message: "An image already exists at sequence 4" }],
        }),
      });
    }
    expect(requestBody).toContain("5");
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ addedRows: 1, addedProducts: 1 }),
    });
  });

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "product-image-folder-e2e-"));
  const duplicateFolder = path.join(tempRoot, "duplicates");
  const validFolder = path.join(tempRoot, "valid");
  await Promise.all([mkdir(duplicateFolder), mkdir(validFolder)]);
  await Promise.all([
    writeFile(path.join(duplicateFolder, "known-product.jpg"), "image"),
    writeFile(path.join(duplicateFolder, "known-product.png"), "image"),
    writeFile(path.join(validFolder, "known-product.jpg"), "image"),
  ]);

  try {
    await page.goto("/admin/catalog");
    await page.getByTestId("button-open-image-csv").click();
    await page.getByTestId("checkbox-image-folder-mode").click();
    const folderInput = page.getByTestId("input-image-folder");
    await folderInput.setInputFiles(duplicateFolder);
    await expect(page.getByTestId("image-folder-row-0")).toContainText("Only one file per product");
    await expect(page.getByTestId("button-apply-image-folder")).toBeDisabled();

    await folderInput.setInputFiles(validFolder);
    await page.getByTestId("input-image-folder-sequence").fill("4");
    await expect(page.getByTestId("image-folder-row-0")).toContainText("Ready");
    await expect(page.getByTestId("image-folder-row-0")).toContainText("4");
    await page.getByTestId("button-apply-image-folder").click();
    await expect(page.getByTestId("image-folder-server-errors")).toContainText("known-product.jpg: An image already exists at sequence 4");
    await expect(page.getByTestId("button-apply-image-folder")).toBeEnabled();
    await page.getByTestId("input-image-folder-sequence").fill("5");
    await page.getByTestId("button-apply-image-folder").click();
    await expect(page.getByTestId("image-csv-result")).toContainText("Added 1 image to 1 product");
    expect(submissions).toBe(2);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("image CSV endpoint requires admin catalog access when authentication is configured", async ({ request }) => {
  test.skip(!process.env.ADMIN_USERNAME || !(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH),
    "Requires configured admin authentication");
  const response = await request.post("/api/admin/products/import-image-urls", {
    data: { rows: [{ productId: "unknown", imageUrl: "/images/test.jpg", imageSequenceNumber: 2 }] },
  });
  expect(response.status()).toBe(401);
});

test("folder image endpoint requires admin catalog access when authentication is configured", async ({ request }) => {
  test.skip(!process.env.ADMIN_USERNAME || !(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH),
    "Requires configured admin authentication");
  const response = await request.post("/api/admin/products/import-image-files", {
    multipart: {
      imageSequenceNumber: "2",
      images: { name: "unknown.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake") },
    },
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