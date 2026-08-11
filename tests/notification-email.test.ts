/**
 * Unit tests for order confirmation email HTML generation in notification.ts.
 * Verifies that the shipping fee is rendered correctly (formatted amount vs "FREE")
 * for both COD and Razorpay checkout paths.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import only the pure HTML builder — no network or DB dependencies.
import { buildCustomerEmailHtml } from "../server/providers/notification.js";
import type { OrderNotification } from "../server/providers/notification.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseNotification(overrides: Partial<OrderNotification> = {}): OrderNotification {
  return {
    orderId: "test-order-id-12345678",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "9876543210",
    total: 1500,
    itemCount: 2,
    subtotal: 1200,
    discount: 0,
    shippingFee: 0,
    items: [
      {
        productName: "Personalised Towel",
        productPrice: 600,
        quantity: 1,
        personalizationName: "Priya",
        isFree: false,
      },
      {
        productName: "Luxury Blanket",
        productPrice: 600,
        quantity: 1,
        personalizationName: null,
        isFree: false,
      },
    ],
    shippingAddress: "123 Test Street",
    shippingCity: "Mumbai",
    shippingState: "Maharashtra",
    shippingPincode: "400001",
    paymentStatus: "cod",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// COD path — non-zero shipping fee
// ---------------------------------------------------------------------------

describe("COD order with non-zero delivery tier fee", () => {
  test("customer email shows formatted shipping fee, not FREE", () => {
    const notification = baseNotification({
      shippingFee: 300,
      total: 1500,
      paymentStatus: "cod",
    });

    const html = buildCustomerEmailHtml(notification);

    // Should contain the formatted rupee amount for shipping.
    assert.ok(
      html.includes("₹300"),
      `Expected email HTML to contain "₹300" but it did not.\nSnippet: ${html.slice(html.indexOf("Shipping") - 50, html.indexOf("Shipping") + 300)}`
    );

    // The word FREE must not appear as the shipping value.
    // Extract just the shipping row to avoid false positives from item "FREE" labels.
    const shippingRowMatch = html.match(/Shipping[\s\S]{0,300}/);
    const shippingSection = shippingRowMatch ? shippingRowMatch[0] : "";
    assert.ok(
      !shippingSection.startsWith("FREE") && !shippingSection.includes(">FREE<"),
      `Expected shipping row NOT to show "FREE" but found: ${shippingSection.slice(0, 200)}`
    );
  });

  test("customer email shows 'Cash on Delivery' for COD payment", () => {
    const notification = baseNotification({ shippingFee: 300, paymentStatus: "cod" });
    const html = buildCustomerEmailHtml(notification);
    assert.ok(html.includes("Cash on Delivery"), "Expected payment status to read 'Cash on Delivery'");
  });
});

// ---------------------------------------------------------------------------
// COD path — zero shipping fee
// ---------------------------------------------------------------------------

describe("COD order with zero shipping fee", () => {
  test("customer email shows FREE for shipping", () => {
    const notification = baseNotification({
      shippingFee: 0,
      total: 1200,
      paymentStatus: "cod",
    });

    const html = buildCustomerEmailHtml(notification);

    // Locate the shipping section and confirm FREE appears.
    const shippingIdx = html.indexOf("Shipping");
    assert.ok(shippingIdx !== -1, "Expected 'Shipping' label in email HTML");
    const shippingSection = html.slice(shippingIdx, shippingIdx + 400);
    assert.ok(
      shippingSection.includes("FREE"),
      `Expected "FREE" for zero-fee shipping but got: ${shippingSection.slice(0, 200)}`
    );
  });

  test("customer email does NOT show a rupee shipping amount when fee is zero", () => {
    const notification = baseNotification({
      shippingFee: 0,
      total: 1200,
      paymentStatus: "cod",
    });

    const html = buildCustomerEmailHtml(notification);
    const shippingIdx = html.indexOf("Shipping");
    const shippingSection = html.slice(shippingIdx, shippingIdx + 400);

    // There should be no ₹0 label in the shipping row.
    assert.ok(
      !shippingSection.includes("₹0"),
      `Expected no "₹0" in shipping row but found: ${shippingSection.slice(0, 200)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Razorpay (paid) path — non-zero shipping fee
// ---------------------------------------------------------------------------

describe("Razorpay (paid) order with non-zero delivery tier fee", () => {
  test("customer email shows formatted shipping fee, not FREE", () => {
    const notification = baseNotification({
      shippingFee: 150,
      total: 1350,
      paymentStatus: "paid",
    });

    const html = buildCustomerEmailHtml(notification);

    assert.ok(
      html.includes("₹150"),
      `Expected email HTML to contain "₹150" but it did not.`
    );

    const shippingIdx = html.indexOf("Shipping");
    const shippingSection = html.slice(shippingIdx, shippingIdx + 400);
    assert.ok(
      !shippingSection.includes(">FREE<"),
      `Expected shipping row NOT to show "FREE" for paid order with fee=150: ${shippingSection.slice(0, 200)}`
    );
  });

  test("customer email shows 'Paid' for Razorpay payment", () => {
    const notification = baseNotification({ shippingFee: 150, paymentStatus: "paid" });
    const html = buildCustomerEmailHtml(notification);
    assert.ok(html.includes("Paid"), "Expected payment status to read 'Paid'");
    assert.ok(!html.includes("Cash on Delivery"), "Expected no 'Cash on Delivery' label for paid order");
  });
});

// ---------------------------------------------------------------------------
// Razorpay (paid) path — zero shipping fee
// ---------------------------------------------------------------------------

describe("Razorpay (paid) order with zero shipping fee", () => {
  test("customer email shows FREE for shipping", () => {
    const notification = baseNotification({
      shippingFee: 0,
      total: 1200,
      paymentStatus: "paid",
    });

    const html = buildCustomerEmailHtml(notification);
    const shippingIdx = html.indexOf("Shipping");
    assert.ok(shippingIdx !== -1, "Expected 'Shipping' label in email HTML");
    const shippingSection = html.slice(shippingIdx, shippingIdx + 400);
    assert.ok(
      shippingSection.includes("FREE"),
      `Expected "FREE" for zero-fee shipping (paid path) but got: ${shippingSection.slice(0, 200)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("Edge cases", () => {
  test("undefined shippingFee treated as free shipping", () => {
    const notification = baseNotification({ shippingFee: undefined, total: 1200 });
    const html = buildCustomerEmailHtml(notification);
    const shippingIdx = html.indexOf("Shipping");
    const shippingSection = html.slice(shippingIdx, shippingIdx + 400);
    assert.ok(
      shippingSection.includes("FREE"),
      `Expected "FREE" when shippingFee is undefined: ${shippingSection.slice(0, 200)}`
    );
  });

  test("discount is displayed when non-zero", () => {
    const notification = baseNotification({ discount: 200, total: 1000 });
    const html = buildCustomerEmailHtml(notification);
    assert.ok(html.includes("₹200"), "Expected discount amount in email");
    assert.ok(html.includes("Buy 2 Get 1"), "Expected discount label in email");
  });

  test("discount section is hidden when discount is zero", () => {
    const notification = baseNotification({ discount: 0, total: 1200 });
    const html = buildCustomerEmailHtml(notification);
    assert.ok(!html.includes("Buy 2 Get 1"), "Expected no discount row when discount=0");
  });
});
