import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "Pragma": "no-cache",
    },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const v = nanoid();
      // Replace the static module script with one that:
      // 1. Clears all SW registrations and their caches (awaited, blocking)
      // 2. Only THEN imports main.tsx (with a unique URL to bypass any remaining cache)
      template = template.replace(
        `<script type="module" src="/src/main.tsx"></script>`,
        `<script type="module">
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        const cacheKeys = (typeof caches !== 'undefined') ? await caches.keys() : [];
        await Promise.all([
          ...regs.map(r => r.unregister()),
          ...cacheKeys.map(k => caches.delete(k)),
        ]);
      }
    }
  } catch(e) {}
  await import('/src/main.tsx?v=${v}');
})();
</script>`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
