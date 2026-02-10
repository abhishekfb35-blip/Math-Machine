import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { addToCartSchema, updateCartItemSchema, checkoutSchema } from "@shared/routes";
import { z } from "zod";
import crypto from "crypto";

function getSessionId(req: Request, res: Response): string {
  let sessionId = req.cookies?.cart_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("cart_session", sessionId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }
  return sessionId;
}

function calculateDiscount(items: { price: number; quantity: number }[]): { subtotal: number; discount: number; total: number; freeIndices: number[] } {
  const expanded: { price: number; originalIndex: number }[] = [];
  items.forEach((item, idx) => {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ price: item.price, originalIndex: idx });
    }
  });

  const subtotal = expanded.reduce((sum, item) => sum + item.price, 0);
  const count = expanded.length;

  if (count < 3) {
    return { subtotal, discount: 0, total: subtotal, freeIndices: [] };
  }

  expanded.sort((a, b) => b.price - a.price);

  const numFree = Math.floor(count / 2);
  let discount = 0;
  const freeIndices: number[] = [];

  for (let i = count - 1; i >= count - numFree; i--) {
    discount += expanded[i].price;
    freeIndices.push(i);
  }

  return { subtotal, discount, total: subtotal - discount, freeIndices };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.get("/api/categories/:slug", async (req, res) => {
    const cat = await storage.getCategoryBySlug(req.params.slug);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  });

  app.get("/api/products", async (_req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) return res.status(400).json({ message: "Invalid category ID" });
    const prods = await storage.getProductsByCategory(categoryId);
    res.json(prods);
  });

  app.get("/api/products/:slug", async (req, res) => {
    const prod = await storage.getProductBySlug(req.params.slug);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(prod);
  });

  app.get("/api/cart", async (req, res) => {
    const sessionId = getSessionId(req, res);
    const cart = await storage.getOrCreateCart(sessionId);
    const items = await storage.getCartItems(cart.id);

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await storage.getProductById(item.productId);
        return { ...item, product };
      })
    );

    const priceItems = itemsWithProducts
      .filter(i => i.product)
      .map(i => ({ price: i.product!.price, quantity: i.quantity }));

    const pricing = calculateDiscount(priceItems);

    res.json({
      id: cart.id,
      items: itemsWithProducts,
      itemCount: itemsWithProducts.reduce((sum, i) => sum + i.quantity, 0),
      ...pricing,
    });
  });

  app.post("/api/cart/items", async (req, res) => {
    try {
      const input = addToCartSchema.parse(req.body);
      const sessionId = getSessionId(req, res);
      const cart = await storage.getOrCreateCart(sessionId);

      const product = await storage.getProductById(input.productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const existingItems = await storage.getCartItems(cart.id);
      const existing = existingItems.find(
        i => i.productId === input.productId && i.personalizationName === (input.personalizationName || null)
      );

      if (existing) {
        const updated = await storage.updateCartItem(existing.id, existing.quantity + input.quantity);
        return res.json(updated);
      }

      const item = await storage.addCartItem({
        cartId: cart.id,
        productId: input.productId,
        quantity: input.quantity,
        personalizationName: input.personalizationName || null,
      });

      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/cart/items/:id", async (req, res) => {
    try {
      const input = updateCartItemSchema.parse(req.body);
      const id = parseInt(req.params.id);

      if (input.quantity === 0) {
        await storage.removeCartItem(id);
        return res.status(204).send();
      }

      const updated = await storage.updateCartItem(id, input.quantity, input.personalizationName);
      if (!updated) return res.status(404).json({ message: "Item not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/cart/items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeCartItem(id);
    res.status(204).send();
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const input = checkoutSchema.parse(req.body);
      const sessionId = getSessionId(req, res);
      const cart = await storage.getOrCreateCart(sessionId);
      const items = await storage.getCartItems(cart.id);

      if (items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProductById(item.productId);
          return { ...item, product };
        })
      );

      const priceItems = itemsWithProducts
        .filter(i => i.product)
        .map(i => ({ price: i.product!.price, quantity: i.quantity }));

      const pricing = calculateDiscount(priceItems);

      const order = await storage.createOrder({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        shippingAddress: input.shippingAddress,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPincode: input.shippingPincode,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        total: pricing.total,
        status: "confirmed",
        paymentStatus: "cod",
        notes: input.notes || null,
        paymentId: null,
      });

      const expanded: { product: typeof itemsWithProducts[0]['product']; personalizationName: string | null }[] = [];
      itemsWithProducts.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          expanded.push({ product: item.product, personalizationName: item.personalizationName });
        }
      });
      expanded.sort((a, b) => (b.product?.price || 0) - (a.product?.price || 0));

      const totalCount = expanded.length;
      const numFree = totalCount >= 3 ? Math.floor(totalCount / 2) : 0;

      for (let i = 0; i < expanded.length; i++) {
        const item = expanded[i];
        if (!item.product) continue;
        const isFree = i >= totalCount - numFree;
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.product.id,
          productName: item.product.name,
          productPrice: item.product.price,
          quantity: 1,
          personalizationName: item.personalizationName,
          isFree,
        });
      }

      await storage.clearCart(cart.id);

      res.status(201).json({ orderId: order.id, ...pricing });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("Checkout error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/site-config", async (_req, res) => {
    const configs = await storage.getAllSiteConfigs();
    const result: Record<string, any> = {};
    for (const c of configs) {
      try { result[c.key] = JSON.parse(c.value); } catch { result[c.key] = c.value; }
    }
    res.json(result);
  });

  app.get("/api/site-config/:key", async (req, res) => {
    const config = await storage.getSiteConfig(req.params.key);
    if (!config) return res.status(404).json({ message: "Config not found" });
    try {
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch {
      res.json({ key: config.key, value: config.value });
    }
  });

  app.post("/api/site-config/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const value = JSON.stringify(req.body.value);
      const config = await storage.upsertSiteConfig(key, value);
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch (err) {
      console.error("Site config save error:", err);
      res.status(500).json({ message: "Failed to save config" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await storage.getOrderById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const items = await storage.getOrderItems(id);
    res.json({ ...order, items });
  });

  return httpServer;
}
