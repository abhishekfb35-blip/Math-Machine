import { test, expect } from "@playwright/test";

test.describe("COD checkout — mobile (400×720)", () => {
  test("fills checkout form and places a Cash on Delivery order", async ({ page }) => {
    const productsRes = await page.request.get("/api/products?limit=5");
    expect(productsRes.ok()).toBeTruthy();
    const products = await productsRes.json();
    expect(products.length).toBeGreaterThan(0);
    const productId = products[0].id;

    const addRes = await page.request.post("/api/cart/items", {
      data: { productId, quantity: 1 },
    });
    expect(addRes.status()).toBeLessThan(300);

    await page.goto("/checkout");

    await expect(page.getByTestId("text-checkout-title")).toBeVisible();

    await page.getByTestId("input-customer-name").fill("Test Customer");
    await page.getByTestId("input-customer-email").fill("testcheckout@example.com");
    await page.getByTestId("input-customer-phone").fill("9876543210");
    await page.getByTestId("input-shipping-address").fill("123 Test Street, Test Area");
    await page.getByTestId("input-shipping-city").fill("Mumbai");
    await page.getByTestId("input-shipping-state").fill("Maharashtra");
    await page.getByTestId("input-shipping-pincode").fill("400001");

    await page.getByTestId("button-payment-cod").click();

    await page.getByTestId("button-place-order").click();

    await page.waitForURL(/\/order\//, { timeout: 15000 });

    await expect(page.getByTestId("text-order-confirmed")).toBeVisible();
    await expect(page.getByTestId("text-order-id")).toBeVisible();
    await expect(page.getByTestId("text-order-id")).toContainText("Order #");
    await expect(page.getByTestId("text-payment-status")).toContainText("Cash on Delivery");
  });
});
