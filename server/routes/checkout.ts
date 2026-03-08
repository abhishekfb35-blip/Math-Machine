import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { checkoutSchema } from "@shared/routes";
import { getSessionId, getAuthenticatedCustomer } from "./helpers";
import { codProvider, getRazorpayProvider } from "../providers/payment";
import { isCCAvenueConfigured, getCCAvenueUrl, getCCAvenueAccessCode, getCCAvenueMerchantId, buildEncryptedRequest, decrypt, parseDecryptedResponse } from "../providers/ccavenue";
import { notificationService } from "../providers/notification";
import { OrderService, EmptyCartError } from "../services/orderService";
import { requireAdmin, getAdminUsername } from "../adminAuth";

const orderService = new OrderService(storage, codProvider, notificationService);

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

      const { calculateDiscount } = await import("../services/discountService");
      const priceItems = itemsWithProducts
        .filter(i => i.product)
        .map(i => ({ price: i.product!.price, quantity: i.quantity }));
      const pricing = calculateDiscount(priceItems);

      let couponDiscount = 0;
      const discountCode = req.body.discountCode;
      if (discountCode?.trim()) {
        const consent = await storage.getCustomerConsentByDiscountCode(discountCode.trim().toUpperCase());
        if (consent && !consent.discountUsed) {
          couponDiscount = Math.round(pricing.total * 0.10);
        }
      }
      const finalAmount = Math.max(0, pricing.total - couponDiscount);

      const result = await razorpay.createPaymentOrder({
        orderId: `cart_${cart.id}`,
        amount: finalAmount,
        currency: "INR",
        customerName: req.body.customerName || "",
        customerEmail: req.body.customerEmail || "",
        customerPhone: req.body.customerPhone || "",
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to create payment order" });
      }

      res.json({
        razorpayOrderId: result.razorpayOrderId,
        amount: finalAmount,
        currency: "INR",
      });
    } catch (err) {
      console.error("Razorpay create order error:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.get("/api/ccavenue/config", (_req, res) => {
    res.json({ available: isCCAvenueConfigured() });
  });

  app.post("/api/ccavenue/initiate", async (req, res) => {
    try {
      if (!isCCAvenueConfigured()) {
        return res.status(503).json({ message: "CCAvenue payment is not configured" });
      }

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

      const { calculateDiscount } = await import("../services/discountService");
      const priceItems = itemsWithProducts
        .filter(i => i.product)
        .map(i => ({ price: i.product!.price, quantity: i.quantity }));
      const pricing = calculateDiscount(priceItems);

      let couponDiscount = 0;
      let consentId: string | null = null;
      const discountCode = req.body.discountCode;
      if (discountCode?.trim()) {
        const consent = await storage.getCustomerConsentByDiscountCode(discountCode.trim().toUpperCase());
        if (consent && !consent.discountUsed) {
          couponDiscount = Math.round(pricing.total * 0.10);
          consentId = consent.id;
        }
      }
      const totalDiscount = pricing.discount + couponDiscount;
      const finalTotal = Math.max(0, pricing.total - couponDiscount);

      const checkoutData = checkoutSchema.parse(req.body);
      const customer = await getAuthenticatedCustomer(req);
      const customerId = customer?.id || null;

      const order = await storage.createOrder({
        customerId,
        customerName: checkoutData.customerName,
        customerEmail: checkoutData.customerEmail,
        customerPhone: checkoutData.customerPhone,
        shippingAddress: checkoutData.shippingAddress,
        shippingCity: checkoutData.shippingCity,
        shippingState: checkoutData.shippingState,
        shippingPincode: checkoutData.shippingPincode,
        subtotal: pricing.subtotal,
        discount: totalDiscount,
        total: finalTotal,
        status: "pending",
        paymentStatus: "pending",
        notes: checkoutData.notes || null,
        paymentId: null,
        discountCode: discountCode?.trim().toUpperCase() || null,
      });

      const expandedItems = itemsWithProducts.filter(i => i.product);
      for (const item of expandedItems) {
        for (let q = 0; q < item.quantity; q++) {
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.product!.id,
            productName: item.product!.name,
            productPrice: item.product!.price,
            quantity: 1,
            personalizationName: item.personalizationName,
            isFree: false,
          });
        }
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      await storage.clearCart(cart.id);

      const encryptedData = buildEncryptedRequest({
        orderId: order.id,
        amount: finalTotal,
        currency: "INR",
        customerName: checkoutData.customerName,
        customerEmail: checkoutData.customerEmail,
        customerPhone: checkoutData.customerPhone,
        shippingAddress: checkoutData.shippingAddress,
        shippingCity: checkoutData.shippingCity,
        shippingState: checkoutData.shippingState,
        shippingPincode: checkoutData.shippingPincode,
        redirectUrl: `${baseUrl}/api/ccavenue/response`,
        cancelUrl: `${baseUrl}/api/ccavenue/response`,
      });

      res.json({
        encryptedData,
        accessCode: getCCAvenueAccessCode(),
        ccavenueUrl: getCCAvenueUrl(),
        orderId: order.id,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("CCAvenue initiate error:", err);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.post("/api/ccavenue/response", async (req, res) => {
    try {
      const encResp = req.body.encResp;
      if (!encResp) {
        return res.redirect("/checkout?error=no_response");
      }

      const decrypted = decrypt(encResp);
      const params = parseDecryptedResponse(decrypted);
      console.log("CCAvenue response:", JSON.stringify(params, null, 2));

      const orderId = params.order_id;
      const orderStatus = params.order_status;
      const trackingId = params.tracking_id || "";
      const responseMerchantId = params.merchant_id;
      const responseAmount = params.amount;
      const responseCurrency = params.currency;

      if (!orderId) {
        return res.redirect("/checkout?error=invalid_response");
      }

      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.redirect("/checkout?error=order_not_found");
      }

      if (responseMerchantId && responseMerchantId !== getCCAvenueMerchantId()) {
        console.error("CCAvenue merchant_id mismatch:", responseMerchantId, "expected:", getCCAvenueMerchantId());
        await storage.updateOrderPayment(orderId, trackingId, "failed");
        await storage.updateOrderStatus(orderId, "cancelled");
        return res.redirect("/checkout?error=payment_failed");
      }

      if (responseAmount && Math.abs(parseFloat(responseAmount) - order.total) > 0.01) {
        console.error("CCAvenue amount mismatch:", responseAmount, "expected:", order.total);
        await storage.updateOrderPayment(orderId, trackingId, "failed");
        await storage.updateOrderStatus(orderId, "cancelled");
        return res.redirect("/checkout?error=payment_failed");
      }

      if (responseCurrency && responseCurrency !== "INR") {
        console.error("CCAvenue currency mismatch:", responseCurrency);
        await storage.updateOrderPayment(orderId, trackingId, "failed");
        await storage.updateOrderStatus(orderId, "cancelled");
        return res.redirect("/checkout?error=payment_failed");
      }

      if (orderStatus === "Success") {
        await storage.updateOrderPayment(orderId, trackingId, "paid");

        if (order.discountCode) {
          const consent = await storage.getCustomerConsentByDiscountCode(order.discountCode);
          if (consent && !consent.discountUsed) {
            await storage.markConsentDiscountUsed(consent.id);
          }
        }

        const orderItems = await storage.getOrderItems(orderId);
        const itemDetails = orderItems.map(item => ({
          productName: item.productName,
          productPrice: item.productPrice,
          quantity: item.quantity,
          personalizationName: item.personalizationName,
          isFree: item.isFree,
        }));

        notificationService.sendOrderConfirmation({
          orderId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          total: order.total,
          subtotal: order.subtotal,
          discount: order.discount,
          itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
          items: itemDetails,
          shippingAddress: order.shippingAddress,
          shippingCity: order.shippingCity,
          shippingState: order.shippingState,
          shippingPincode: order.shippingPincode,
          paymentStatus: "paid",
        }).catch(err => console.error("Notification error:", err));

        return res.redirect(`/order/${orderId}?payment=success`);
      } else if (orderStatus === "Aborted") {
        await storage.updateOrderPayment(orderId, trackingId, "failed");
        await storage.updateOrderStatus(orderId, "cancelled");
        return res.redirect(`/checkout?error=payment_cancelled`);
      } else {
        await storage.updateOrderPayment(orderId, trackingId, "failed");
        await storage.updateOrderStatus(orderId, "cancelled");
        return res.redirect(`/checkout?error=payment_failed`);
      }
    } catch (err) {
      console.error("CCAvenue response error:", err);
      res.redirect("/checkout?error=processing_error");
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const { paymentMethod, razorpayPaymentId, razorpayOrderId, razorpaySignature, discountCode, ...checkoutData } = req.body;
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

          const cart = await storage.getOrCreateCart(sessionId);
          const items = await storage.getCartItems(cart.id);
          const itemsWithProducts = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProductById(item.productId);
              return { ...item, product };
            })
          );
          const priceItems = itemsWithProducts.filter(i => i.product).map(i => ({ price: i.product!.price, quantity: i.quantity }));
          const { calculateDiscount } = await import("../services/discountService");
          const pricing = calculateDiscount(priceItems);
          couponDiscount = Math.round(pricing.total * 0.10);
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
        });
        if (consentId) await storage.markConsentDiscountUsed(consentId);
        return res.status(201).json(result);
      }

      const result = await orderService.checkout(sessionId, { ...input, customerId, discountCode: validatedDiscountCode, couponDiscount });
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

  app.post("/api/site-config/:key", requireAdmin, async (req, res) => {
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
