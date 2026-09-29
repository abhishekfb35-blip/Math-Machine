import assert from "node:assert/strict";
import test from "node:test";
import {
  getMetaCatalogGroupId,
  getMetaCatalogItemId,
  getMetaCatalogTrackingIdentity,
} from "../shared/metaCatalogIds.ts";

test("Meta catalog IDs are stable and distinguish product variants", () => {
  const mediumBlue = getMetaCatalogItemId("product-1", "M", "Blue");
  assert.equal(mediumBlue, getMetaCatalogItemId("product-1", " M ", "BLUE"));
  assert.notEqual(mediumBlue, getMetaCatalogItemId("product-1", "L", "Blue"));
  assert.notEqual(mediumBlue, getMetaCatalogItemId("product-1", "M", "Red"));
  assert.equal(getMetaCatalogItemId("product-1"), "product-1");
  assert.equal(getMetaCatalogGroupId("product-1"), "product-1");
  assert.ok(mediumBlue.length < 100);
});

test("composite cart selections use the product group ID", () => {
  assert.deepEqual(
    getMetaCatalogTrackingIdentity("product-1", undefined, "M: Blue · L: Red"),
    { id: "product-1", contentType: "product_group" },
  );
  assert.deepEqual(
    getMetaCatalogTrackingIdentity("product-1", "M", "Blue"),
    { id: getMetaCatalogItemId("product-1", "M", "Blue"), contentType: "product" },
  );
});