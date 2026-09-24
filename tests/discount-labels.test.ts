import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCartDiscountLabel } from "../client/src/lib/discountLabels";

const thresholds = {
  retailFreeItemTrigger: 3,
  retailBonusDiscountPct: 30,
  wholesaleThreshold: 5,
};

describe("cart promotion labels", () => {
  it("describes the free-item promotion at the free-item threshold", () => {
    assert.equal(getCartDiscountLabel(3, thresholds), "Buy 2 Get 1 Free*");
  });

  it("describes the free item plus bonus discount at the next threshold", () => {
    assert.equal(getCartDiscountLabel(4, thresholds), "1 Free Item + 30% Off*");
  });

  it("describes bulk pricing instead of calling it a free-item offer", () => {
    assert.equal(getCartDiscountLabel(5, thresholds), "Best Rates");
    assert.equal(getCartDiscountLabel(8, thresholds), "Best Rates");
  });

  it("uses configured thresholds and defaults safely", () => {
    assert.equal(
      getCartDiscountLabel(4, {
        retailFreeItemTrigger: 4,
        retailBonusDiscountPct: 25,
        wholesaleThreshold: 6,
      }),
      "Buy 3 Get 1 Free*",
    );
    assert.equal(getCartDiscountLabel(4, null), "1 Free Item + 30% Off*");
  });
});