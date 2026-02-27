import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { addToCartSchema, updateCartItemSchema } from "@shared/routes";
import { CartService, NotFoundError } from "../services/cartService";
import { getSessionId } from "./helpers";

const cartService = new CartService(storage);

export function registerCartRoutes(app: Express) {
  app.get("/api/cart", async (req, res) => {
    const sessionId = getSessionId(req, res);
    const cartDetails = await cartService.getCartDetails(sessionId);
    res.json(cartDetails);
  });

  app.post("/api/cart/items", async (req, res) => {
    try {
      const input = addToCartSchema.parse(req.body);
      const sessionId = getSessionId(req, res);
      const { item, isNew } = await cartService.addItem(
        sessionId, input.productId, input.quantity, input.personalizationName || null
      );
      res.status(isNew ? 201 : 200).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/cart/items/:id", async (req, res) => {
    try {
      const input = updateCartItemSchema.parse(req.body);
      const id = req.params.id as string;
      const result = await cartService.updateItem(id, input.quantity, input.personalizationName);
      if ("deleted" in result) return res.status(204).send();
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      if (err instanceof NotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/cart/items/:id", async (req, res) => {
    const id = req.params.id as string;
    await cartService.removeItem(id);
    res.status(204).send();
  });
}
