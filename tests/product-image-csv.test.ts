import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseImageCsv } from "../client/src/lib/productImageCsv";
import { duplicateImageImportRows, imageImportSchema } from "../shared/productImageImport";

const header = "product_id,image_url,image_sequence_number";

describe("product image CSV", () => {
  it("parses quoted commas, escaped quotes and line breaks", () => {
    const result = parseImageCsv(`${header}\r\np1,"https://example.com/a,b.jpg",2\r\np2,"https://example.com/a?text=""hi""\nnext",3`);
    assert.equal(result.error, undefined);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].imageUrl, "https://example.com/a,b.jpg");
    assert.equal(result.rows[1].line, 3);
  });

  it("reports wrong headers and malformed CSV", () => {
    assert.match(parseImageCsv("product_id,image_url\np1,x").error!, /Expected headers/);
    assert.match(parseImageCsv(`${header}\np1,"unclosed,2`).error!, /Unclosed quote/);
    assert.match(parseImageCsv(`${header}\np1,/image.jpg,2,extra`).rows[0].errors.join(" "), /exactly 3/);
    assert.match(parseImageCsv(`${header}\n,,`).rows[0].errors.join(" "), /required/i);
  });

  it("rejects hero, unknown products, duplicate positions and invalid URLs before applying", () => {
    const result = parseImageCsv(`${header}\np1,/images/gallery.jpg,1\nmissing,https://example.com/a.jpg,2\np1,not-a-url,2\np1,/images/a.jpg,3\np1,/images/b.jpg,3`, new Set(["p1"]));
    assert.match(result.rows[0].errors.join(" "), /2 or greater/);
    assert.match(result.rows[1].errors.join(" "), /not found/);
    assert.match(result.rows[2].errors.join(" "), /URL/);
    assert.match(result.rows[3].errors.join(" "), /Duplicate/);
    assert.match(result.rows[4].errors.join(" "), /Duplicate/);
    assert.deepEqual(duplicateImageImportRows([
      { productId: "p1", imageUrl: "/a", imageSequenceNumber: 2 },
      { productId: "p1", imageUrl: "/b", imageSequenceNumber: 2 },
    ]), [0, 1]);
    assert.equal(imageImportSchema.safeParse({ rows: [{ productId: "p1", imageUrl: "/a", imageSequenceNumber: 1 }] }).success, false);
    assert.equal(imageImportSchema.safeParse({ rows: [{ productId: "p1", imageUrl: "javascript:alert(1)", imageSequenceNumber: 2 }] }).success, false);
  });
});