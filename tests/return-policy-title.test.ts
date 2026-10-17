import assert from "node:assert/strict";
import test from "node:test";
import { defaultRefundPage, normalizePolicyPage } from "../client/src/lib/siteConfigDefaults";

test("legacy saved refund policy titles display the new return and refund name", () => {
  for (const title of ["Refund Policy", "Refund & Cancellation Policy", "Return & Refund Policy"]) {
    const normalized = normalizePolicyPage({ ...defaultRefundPage, title }, defaultRefundPage);
    assert.equal(normalized.title, "Return and Refund Policy");
  }
});

test("custom refund policy titles remain editable", () => {
  const normalized = normalizePolicyPage(
    { ...defaultRefundPage, title: "Our Personalised Order Policy" },
    defaultRefundPage,
  );
  assert.equal(normalized.title, "Our Personalised Order Policy");
});
