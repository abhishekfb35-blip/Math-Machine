import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ID_BEARING_SEED_TABLES, validateSeedSnapshotIds } from "../server/lib/seedValidation";

describe("seed snapshot ID validation", () => {
  it("accepts existing IDs for every ID-bearing seed section", () => {
    const snapshot = Object.fromEntries(
      ID_BEARING_SEED_TABLES.map((table) => [table, [{ id: `${table}-existing` }]]),
    );
    assert.doesNotThrow(() => validateSeedSnapshotIds(snapshot));
  });

  it("rejects missing, blank, and non-string IDs with the section name", () => {
    for (const table of ID_BEARING_SEED_TABLES) {
      for (const row of [{}, { id: "" }, { id: "   " }, { id: 123 }]) {
        assert.throws(
          () => validateSeedSnapshotIds({ [table]: [row] }),
          new RegExp(`${table}\\[0\\].*id`),
        );
      }
    }
  });

  it("rejects malformed sections before any row can be written", () => {
    assert.throws(
      () => validateSeedSnapshotIds({ products: { id: "not-an-array" } }),
      /products must be an array/,
    );
  });
});