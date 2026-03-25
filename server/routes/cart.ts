import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { addToCartSchema, updateCartItemSchema } from "@shared/routes";
import { CartService, NotFoundError } from "../services/cartService";
import { getSessionId, getAuthenticatedCustomer } from "./helpers";

const cartService = new CartService(storage);

async function touchCart(req: any, res: any, sessionId: string) {
  try {
    const customer = await getAuthenticatedCustomer(req);
    await storage.updateCartActivity(sessionId, customer?.id ?? null);
  } catch {
  }
}

export function registerCartRoutes(app: Express) {
  app.get("/api/cart", async (req, res) => {
    const sessionId = getSessionId(req, res);
    const currency: string = (req.cookies?.tl_currency as string) || "INR";
    const isDomestic = currency.toUpperCase() === "INR";
    const cartDetails = await cartService.getCartDetails(sessionId, isDomestic);
    res.json(cartDetails);
  });

  app.post("/api/cart/items", async (req, res) => {
    try {
      const input = addToCartSchema.parse(req.body);
      const sessionId = getSessionId(req, res);
      const { item, isNew } = await cartService.addItem(
        sessionId,
        input.productId,
        input.quantity,
        input.personalizationName || null,
        input.selectedColor || null,
        input.selectedSize || null
      );
      await touchCart(req, res, sessionId);
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
      const sessionId = getSessionId(req, res);
      const result = await cartService.updateItem(id, input.quantity, input.personalizationName, input.selectedColor, input.selectedSize);
      if ("deleted" in result) {
        await touchCart(req, res, sessionId);
        return res.status(204).send();
      }
      await touchCart(req, res, sessionId);
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
    const sessionId = getSessionId(req, res);
    await cartService.removeItem(id);
    await touchCart(req, res, sessionId);
    res.status(204).send();
  });
}
