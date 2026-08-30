import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSeedTargetIsWritable, validateProductionDestination } from "../server/lib/catalogSyncGuard";

describe("catalog sync environment guard", () => {
  it("rejects seed writes in development", () => {
    assert.throws(
      () => assertSeedTargetIsWritable({ NODE_ENV: "development" }),
      /disabled outside production/,
    );
  });

  it("allows only an explicitly isolated test database outside production", () => {
    assert.doesNotThrow(() => assertSeedTargetIsWritable({
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgres://isolated",
      DATABASE_URL: "postgres://isolated",
    }));
    assert.throws(
      () => assertSeedTargetIsWritable({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://isolated",
        DATABASE_URL: "postgres://developer",
      }),
      /disabled outside production/,
    );
  });

  it("rejects development, local, and same-environment destinations", () => {
    for (const rawUrl of [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://[::1]:5000",
      "http://0.0.0.0:5000",
      "https://my-app.replit.dev",
      "https://production.example.com",
    ]) {
      assert.throws(
        () => validateProductionDestination(rawUrl, "production.example.com", {
          REPLIT_DEV_DOMAIN: "my-app.replit.dev",
        }),
        /Refusing to sync/,
      );
    }
  });

  it("accepts a distinct HTTPS production destination", () => {
    const destination = validateProductionDestination(
      "https://store.example.com/",
      "my-app.replit.dev",
      { REPLIT_DEV_DOMAIN: "my-app.replit.dev" },
    );
    assert.equal(destination.hostname, "store.example.com");
  });
});