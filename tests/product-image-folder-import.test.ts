import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  maxProductImageFileSize,
  maxProductImageFolderSize,
  previewProductImageFolder,
  productImageFileIdentity,
} from "../shared/productImageFolderImport";

describe("product image folder import", () => {
  it("extracts product IDs from supported image filenames", () => {
    assert.deepEqual(productImageFileIdentity("selected-folder/product-a.JPEG"), {
      productId: "product-a",
      extension: ".jpeg",
      supported: true,
    });
    assert.deepEqual(productImageFileIdentity("no-extension"), {
      productId: "",
      extension: "",
      supported: false,
    });
  });

  it("previews valid files using one sequence for the selected folder", () => {
    const preview = previewProductImageFolder([
      { name: "folder/product-a.jpg", size: 500 },
      { name: "product-b.webp", size: 800 },
    ], new Set(["product-a", "product-b"]), "3");

    assert.deepEqual(preview.errors, []);
    assert.deepEqual(preview.rows.map(row => [row.productId, row.errors]), [
      ["product-a", []],
      ["product-b", []],
    ]);
  });

  it("rejects unknown products, duplicate product files, unsupported types, and the hero sequence", () => {
    const preview = previewProductImageFolder([
      { name: "product-a.jpg", size: 100 },
      { name: "product-a.png", size: 100 },
      { name: "unknown.bmp", size: 100 },
    ], new Set(["product-a"]), "1");

    assert.match(preview.rows[0].errors.join(" "), /Only one file/);
    assert.match(preview.rows[1].errors.join(" "), /Only one file/);
    assert.match(preview.rows[2].errors.join(" "), /Use a \.jpg/);
    assert.match(preview.rows[2].errors.join(" "), /not found/);
    assert.ok(preview.rows.every(row => row.errors.some(error => /2 or greater/.test(error))));
  });

  it("enforces per-image and total folder size limits", () => {
    const preview = previewProductImageFolder([
      { name: "product-a.jpg", size: maxProductImageFileSize + 1 },
      { name: "product-b.jpg", size: maxProductImageFolderSize },
    ], new Set(["product-a", "product-b"]), "2");

    assert.match(preview.rows[0].errors.join(" "), /5 MB or smaller/);
    assert.match(preview.errors.join(" "), /total 50 MB or less/);
  });

  it("rejects empty image files", () => {
    const preview = previewProductImageFolder([{ name: "product-a.jpg", size: 0 }], new Set(["product-a"]), "2");
    assert.match(preview.rows[0].errors.join(" "), /file is empty/);
  });
});