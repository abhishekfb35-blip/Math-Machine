import type { Express, Request, Response } from "express";
import { createId } from "@paralleldrive/cuid2";
import { storage } from "../storage";
import { getAuthenticatedCustomer } from "./helpers";

export function registerWishlistRoutes(app: Express) {
  app.get("/api/wishlist", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    const ids = await storage.getWishlistProductIds(customer.id);
    res.json({ productIds: ids });
  });

  app.post("/api/wishlist", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    const { productId } = req.body;
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ message: "productId is required" });
    }
    await storage.addToWishlist(customer.id, productId);
    res.json({ success: true });
  });

  app.delete("/api/wishlist/:productId", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    await storage.removeFromWishlist(customer.id, req.params.productId);
    res.json({ success: true });
  });

  app.post("/api/wishlist/sync", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      return res.status(400).json({ message: "productIds must be an array" });
    }
    await storage.syncWishlist(customer.id, productIds);
    const ids = await storage.getWishlistProductIds(customer.id);
    res.json({ productIds: ids });
  });
}
