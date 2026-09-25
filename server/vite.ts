import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { IStorage } from "./storage";
import { registerStorefrontDocumentRoutes } from "./storefrontHtml";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express, storage: IStorage) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
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

  const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
  registerStorefrontDocumentRoutes(app, storage, {
    getTemplate: async () => {
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      return template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
    },
    transformHtml: async (url, html) => {
      try {
        return await vite.transformIndexHtml(url, html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        throw error;
      }
    },
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    try {
      const template = (await fs.promises.readFile(clientTemplate, "utf-8")).replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
