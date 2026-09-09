import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";

let server: Server;
let origin: string;
let serviceWorkerSource: string;
let version = "v1";
let breakCurrentAsset = false;

function pageHtml(currentVersion: string) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>SW fixture</title></head>
  <body>
    <main id="version">${currentVersion}</main>
    <script src="/assets/app-${currentVersion}.js"></script>
  </body>
</html>`;
}

test.beforeAll(async () => {
  serviceWorkerSource = await readFile("client/public/sw.js", "utf-8");
  server = createServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;

    if (pathname === "/sw.js") {
      res.writeHead(200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(serviceWorkerSource.replaceAll("__BUILD_ID__", version));
      return;
    }

    if (pathname === "/") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(pageHtml(version));
      return;
    }

    if (pathname === `/assets/app-${version}.js`) {
      if (breakCurrentAsset) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(pageHtml(version));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.end(`document.documentElement.dataset.assetVersion = "${version}";`);
      return;
    }

    if (pathname === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not start");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test.beforeEach(async ({ context }) => {
  version = "v1";
  breakCurrentAsset = false;
  await context.clearCookies();
});

test("keeps a known-good offline shell until a replacement is fully ready", async ({ page, context }) => {
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
      });
    }
  });

  await expect.poll(() => page.evaluate(() => caches.keys())).toContain("turtlelittle-v1");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("v1")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.assetVersion)).toBe("v1");
  await expect(page.evaluate(() => fetch("/api/status"))).rejects.toThrow();
  await context.setOffline(false);

  version = "v2";
  breakCurrentAsset = true;
  const failedState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("Missing registration");
    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Failed update did not settle")), 10000);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "redundant") {
            window.clearTimeout(timeout);
            resolve(worker.state);
          }
        });
      }, { once: true });
      registration.update().catch(reject);
    });
  });
  expect(failedState).toBe("redundant");
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain("turtlelittle-v2");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("v1")).toBeVisible();
  await context.setOffline(false);

  breakCurrentAsset = false;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("Missing registration");
    const changed = new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
    await registration.update();
    await changed;
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("v2")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.assetVersion)).toBe("v2");
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(["turtlelittle-v2"]);
});