import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffByContent, diffById, diffSiteContent } from "../server/lib/dbCompare";

describe("DB Compare diffs", () => {
  it("detects changed values plus missing and extra rows", () => {
    const diff = diffById(
      [{ id: "a", name: "Dev" }, { id: "dev-only", name: "Only dev" }],
      [{ id: "a", name: "Prod" }, { id: "prod-only", name: "Only prod" }],
      ["name"],
    );

    assert.deepEqual(diff.onlyInDev, ["dev-only"]);
    assert.deepEqual(diff.onlyInProd, ["prod-only"]);
    assert.deepEqual(diff.fieldMismatches, [
      { id: "a", field: "name", dev: "Dev", prod: "Prod" },
    ]);
  });

  it("detects changed product attribute and content links", () => {
    const diff = diffByContent(
      [
        { product: "blanket", attribute: "infant" },
        { product: "towel", attribute: "His Her Designs" },
      ],
      [
        { product: "blanket", attribute: "kids" },
        { product: "towel", attribute: "His Her Designs" },
      ],
      (row) => `${row.product}|${row.attribute}`,
      (row) => `${row.product} → ${row.attribute}`,
    );

    assert.deepEqual(diff.onlyInDev, ["blanket → infant"]);
    assert.deepEqual(diff.onlyInProd, ["blanket → kids"]);
  });

  it("detects site-content value changes independently of row counts", () => {
    const diff = diffSiteContent(
      [{ key: "wishlist-signup-prompt", value: "New copy" }],
      [{ key: "wishlist-signup-prompt", value: "Old copy" }],
    );

    assert.equal(diff.devCount, diff.prodCount);
    assert.deepEqual(diff.onlyInDev, []);
    assert.deepEqual(diff.onlyInProd, []);
    assert.deepEqual(diff.valueChanged, ["wishlist-signup-prompt"]);
  });
});