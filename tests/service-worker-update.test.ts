import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service worker uses a build-specific cache and never fabricates API data", async () => {
  const source = await readFile("client/public/sw.js", "utf-8");

  assert.match(source, /__BUILD_ID__/);
  assert.match(source, /startsWith\(CACHE_PREFIX\)/);
  assert.match(source, /warmAppShell\(\)\.then\(\(\) => self\.skipWaiting\(\)\)/);
  assert.match(source, /contentType\.includes\('text\/html'\)/);
  assert.match(source, /await Promise\.all/);
  assert.match(source, /await caches\.delete\(CACHE_NAME\)/);
  assert.match(source, /\.then\(\(\) => self\.clients\.claim\(\)\)/);
  assert.match(source, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
  assert.match(source, /if \(url\.pathname\.startsWith\('\/api\/'\)\) return;/);
  assert.doesNotMatch(source, /JSON\.stringify\(\[\]\)/);
});

test("client registration bypasses HTTP caches and reloads controlled pages on update", async () => {
  const source = await readFile("client/src/main.tsx", "utf-8");

  assert.match(source, /updateViaCache: "none"/);
  assert.match(source, /registration\.update\(\)/);
  assert.match(source, /controllerchange/);
  assert.match(source, /window\.location\.reload\(\)/);
});

test("production server revalidates the worker and app shell", async () => {
  const source = await readFile("server/static.ts", "utf-8");

  assert.match(source, /fileName === "sw\.js" \|\| fileName === "index\.html"/);
  assert.match(source, /no-cache, no-store, must-revalidate/);
  assert.match(source, /max-age=31536000, immutable/);
  assert.match(source, /req\.path\.startsWith\("\/assets\/"\)/);
  assert.match(source, /status\(404\)\.send\("Asset not found"\)/);
});