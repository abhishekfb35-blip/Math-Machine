import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { checkoutSchema } from "@shared/routes";
import { getSessionId, getAuthenticatedCustomer } from "./helpers";
import { codProvider, getRazorpayProvider } from "../providers/payment";
import { notificationService } from "../providers/notification";
import { OrderService, EmptyCartError } from "../services/orderService";
import { CartService } from "../services/cartService";
import { requireAdmin, getAdminUsername, requirePermission } from "../adminAuth";
import { convertFromINR } from "../services/exchangeRateService";

const orderService = new OrderService(storage, codProvider, notificationService);
const cartService = new CartService(storage);

export function registerCheckoutRoutes(app: Express) {

  app.get("/api/razorpay/key", (_req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return res.json({ available: false });
    }
    res.json({ available: true, keyId });
  });

  app.post("/api/razorpay/create-order", async (req, res) => {
    try {
      const razorpay = getRazorpayProvider();
      if (!razorpay) {
        return res.status(503).json({ message: "Online payment is not configured" });
      }

      const sessionId = getSessionId(req, res);
      const requestedCurrency = (req.body.currency as string)?.toUpperCase() || "INR";
      const isDomestic = requestedCurrency === "INR";
      const pricing = await cartService.getCartDetails(sessionId, isDomestic);

      if (pricing.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      let couponDiscount = 0;
      const discountCode = req.body.discountCode;
      if (discountCode?.trim()) {
        const consent = await storage.getCustomerConsentByDiscountCode(discountCode.trim().toUpperCase());
        if (consent && !consent.discountUsed) {
          couponDiscount = Math.round(pricing.total * 0.10);
        }
      }
      const finalAmount = Math.max(0, pricing.total - couponDiscount);

      const converted = await convertFromINR(finalAmount, requestedCurrency);

      const result = await razorpay.createPaymentOrder({
        orderId: `cart_${pricing.id}`,
        amount: converted.amount,
        currency: converted.currency,
        customerName: req.body.customerName || "",
        customerEmail: req.body.customerEmail || "",
        customerPhone: req.body.customerPhone || "",
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to create payment order" });
      }

      res.json({
        razorpayOrderId: result.razorpayOrderId,
        amount: converted.amount,
        currency: converted.currency,
      });
    } catch (err) {
      console.error("Razorpay create order error:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const { paymentMethod, razorpayPaymentId, razorpayOrderId, razorpaySignature, discountCode, currency: paymentCurrency, ...checkoutData } = req.body;
      const input = checkoutSchema.parse(checkoutData);
      const sessionId = getSessionId(req, res);

      const customer = await getAuthenticatedCustomer(req);
      const customerId = customer?.id || null;

      let couponDiscount = 0;
      let validatedDiscountCode: string | null = null;
      let consentId: string | null = null;

      if (discountCode?.trim()) {
        const consent = await storage.getCustomerConsentByDiscountCode(discountCode.trim().toUpperCase());
        if (consent && !consent.discountUsed) {
          validatedDiscountCode = consent.discountCode;
          consentId = consent.id;
          const couponIsDomestic = !paymentCurrency || (paymentCurrency as string).toUpperCase() === "INR";
          const couponPricing = await cartService.getCartDetails(sessionId, couponIsDomestic);
          couponDiscount = Math.round(couponPricing.total * 0.10);
        }
      }

      if (paymentMethod === "razorpay") {
        const razorpay = getRazorpayProvider();
        if (!razorpay) {
          return res.status(503).json({ message: "Online payment is not configured" });
        }

        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
          return res.status(400).json({ message: "Missing payment details" });
        }

        const verification = await razorpay.verifyPayment(razorpayPaymentId, razorpaySignature, razorpayOrderId);
        if (!verification.success) {
          return res.status(400).json({ message: verification.error || "Payment verification failed" });
        }

        const razorpayOrderService = new OrderService(storage, razorpay, notificationService);
        const result = await razorpayOrderService.checkoutWithPayment(sessionId, {
          ...input,
          customerId,
          discountCode: validatedDiscountCode,
          couponDiscount,
          paymentId: razorpayPaymentId,
          razorpayOrderId,
          paymentStatus: "paid",
          currency: paymentCurrency || "INR",
        });
        if (consentId) await storage.markConsentDiscountUsed(consentId);
        return res.status(201).json(result);
      }

      const result = await orderService.checkout(sessionId, { ...input, customerId, discountCode: validatedDiscountCode, couponDiscount, currency: paymentCurrency || "INR" });
      if (consentId) await storage.markConsentDiscountUsed(consentId);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      if (err instanceof EmptyCartError) {
        return res.status(400).json({ message: err.message });
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
    const config = await storage.getSiteConfig(req.params.key as string);
    if (!config) return res.status(404).json({ message: "Config not found" });
    try {
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch {
      res.json({ key: config.key, value: config.value });
    }
  });

  const SITE_CONFIG_PERMISSIONS: Record<string, string> = {
    header: "builder",
    hero: "builder",
    homepageCollections: "builder",
    announcement: "builder",
    terms: "pages",
    privacy: "pages",
    refund: "pages",
    shipping: "pages",
    about: "pages",
    seo: "seo",
    "offer-tiers": "offers",
    "delivery-tiers": "offers",
  };

  app.post("/api/site-config/:key", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    const key = req.params.key as string;
    const permission = SITE_CONFIG_PERMISSIONS[key];
    if (permission) {
      return requirePermission(permission)(req, res, next);
    }
    next();
  }, async (req, res) => {
    try {
      const key = req.params.key as string;
      const value = JSON.stringify(req.body.value);
      const config = await storage.upsertSiteConfig(key, value);
      await storage.createAuditLog({
        entityType: "site-config", entityId: key, entityName: key,
        action: "updated", changes: JSON.stringify({ key }), username: getAdminUsername(req),
      });
      res.json({ key: config.key, value: JSON.parse(config.value) });
    } catch (err) {
      console.error("Site config save error:", err);
      res.status(500).json({ message: "Failed to save config" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = req.params.id as string;
    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

}
