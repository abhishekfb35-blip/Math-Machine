import assert from "node:assert/strict";
import test from "node:test";
import { formatShippingCharge } from "../client/src/lib/orderShippingDisplay.ts";

test("admin order shipping display shows the saved non-zero fee", () => {
  assert.equal(formatShippingCharge(300), "₹300");
});

test("admin order shipping display keeps genuinely free shipping labeled FREE", () => {
  assert.equal(formatShippingCharge(0), "FREE");
});
