import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { addToCartSchema, updateCartItemSchema } from "@shared/routes";
import { CartService, NotFoundError } from "../services/cartService";
import { getSessionId, getAuthenticatedCustomer } from "./helpers";

const cartService = new CartService(storage);
const guestCartMutationQueues = new Map<string, Promise<void>>();

async function withGuestCartMutationLock<T>(
  sessionId: string,
  mutate: () => Promise<T>,
): Promise<T> {
  const previous = guestCartMutationQueues.get(sessionId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  guestCartMutationQueues.set(sessionId, current);

  await previous;
  try {
    return await mutate();
  } finally {
    releaseCurrent();
    if (guestCartMutationQueues.get(sessionId) === current) {
      guestCartMutationQueues.delete(sessionId);
    }
  }
}

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
      const currency: string = (req.cookies?.tl_currency as string) || "INR";
      const isDomestic = currency.toUpperCase() === "INR";
      const customer = await getAuthenticatedCustomer(req);
      const addItem = async () => {
        if (!customer) {
          const cart = await storage.getOrCreateCart(sessionId);
          const items = await storage.getCartItems(cart.id);
          const currentQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          if (currentQuantity + input.quantity > 1) {
            return null;
          }
        }
        return cartService.addItem(
          sessionId,
          input.productId,
          input.quantity,
          input.personalizationName || null,
          input.selectedColor || null,
          input.selectedSize || null
        );
      };
      const addResult = customer
        ? await addItem()
        : await withGuestCartMutationLock(sessionId, addItem);
      if (!addResult) {
        return res.status(403).json({
          code: "SIGNUP_REQUIRED",
          message: "Sign in to add more than one item to your cart.",
        });
      }
      const { isNew } = addResult;
      await touchCart(req, res, sessionId);
      const cartDetails = await cartService.getCartDetails(sessionId, isDomestic);
      res.status(isNew ? 201 : 200).json(cartDetails);
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
      const currency: string = (req.cookies?.tl_currency as string) || "INR";
      const isDomestic = currency.toUpperCase() === "INR";
      const customer = await getAuthenticatedCustomer(req);
      const updateItem = async () => {
        if (!customer) {
          const cart = await storage.getOrCreateCart(sessionId);
          const items = await storage.getCartItems(cart.id);
          const currentItem = items.find((item) => item.id === id);
          if (!currentItem) {
            return "not-found" as const;
          }
          const currentQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
          const nextQuantity = currentQuantity - currentItem.quantity + input.quantity;
          if (nextQuantity > 1) {
            return "signup-required" as const;
          }
        }
        await cartService.updateItem(id, input.quantity, input.personalizationName, input.selectedColor, input.selectedSize);
        return "updated" as const;
      };
      const updateResult = customer
        ? await updateItem()
        : await withGuestCartMutationLock(sessionId, updateItem);
      if (updateResult === "not-found") {
        return res.status(404).json({ message: "Item not found" });
      }
      if (updateResult === "signup-required") {
        return res.status(403).json({
          code: "SIGNUP_REQUIRED",
          message: "Sign in to add more than one item to your cart.",
        });
      }
      await touchCart(req, res, sessionId);
      const cartDetails = await cartService.getCartDetails(sessionId, isDomestic);
      res.json(cartDetails);
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
    const currency: string = (req.cookies?.tl_currency as string) || "INR";
    const isDomestic = currency.toUpperCase() === "INR";
    await cartService.removeItem(id);
    await touchCart(req, res, sessionId);
    const cartDetails = await cartService.getCartDetails(sessionId, isDomestic);
    res.json(cartDetails);
  });
}
