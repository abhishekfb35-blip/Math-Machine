import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import type { IStorage } from "./storage";
import { registerStorefrontDocumentRoutes } from "./storefrontHtml";

export function serveStatic(app: Express, storage: IStorage) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  registerStorefrontDocumentRoutes(app, storage, {
    getTemplate: () => fs.promises.readFile(indexPath, "utf-8"),
    transformHtml: async (_url, html) => html,
  });

  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      const normalizedPath = filePath.replaceAll("\\", "/");
      const fileName = path.basename(filePath);

      if (fileName === "sw.js" || fileName === "index.html") {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return;
      }

      if (normalizedPath.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }

      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    if (req.path.startsWith("/assets/")) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).send("Asset not found");
      return;
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
