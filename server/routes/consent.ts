import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { getAuthenticatedCustomer } from "./helpers";

function generateDiscountCode(): string {
  return "TL10-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

const consentRateLimit = new Map<string, number>();

export function registerConsentRoutes(app: Express) {
  app.post("/api/consent", async (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
      const now = Date.now();
      const lastRequest = consentRateLimit.get(ip) || 0;
      if (now - lastRequest < 10000) {
        return res.status(429).json({ message: "Please wait before trying again" });
      }
      consentRateLimit.set(ip, now);

      const { firstName, lastName, email, phone, consentType, consentGiven, pageUrl, consentText } = req.body;

      if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !consentType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existing = await storage.getCustomerConsentByEmail(normalizedEmail, consentType);
      if (existing) {
        return res.json({ alreadyConsented: true });
      }

      const customer = await getAuthenticatedCustomer(req);
      const discountCode = consentGiven ? generateDiscountCode() : null;

      const consent = await storage.createCustomerConsent({
        customerId: customer?.id || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        consentType,
        consentGiven: !!consentGiven,
        discountCode,
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || null,
        pageUrl: pageUrl || null,
        consentMethod: "popup_form",
        consentText: consentText || null,
      });

      res.json({ success: true, discountCode: consent.discountCode });
    } catch (err) {
      console.error("Consent error:", err);
      res.status(500).json({ message: "Failed to save consent" });
    }
  });

  app.post("/api/discount/validate", async (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
      const now = Date.now();
      const lastAttempt = consentRateLimit.get(`discount_${ip}`) || 0;
      if (now - lastAttempt < 2000) {
        return res.status(429).json({ valid: false, message: "Please wait before trying again" });
      }
      consentRateLimit.set(`discount_${ip}`, now);

      const { code } = req.body;
      if (!code?.trim()) {
        return res.status(400).json({ valid: false, message: "Please enter a discount code" });
      }

      const consent = await storage.getCustomerConsentByDiscountCode(code.trim().toUpperCase());
      if (!consent) {
        return res.json({ valid: false, message: "Invalid discount code" });
      }

      if (consent.discountUsed) {
        return res.json({ valid: false, message: "This discount code has already been used" });
      }

      return res.json({ valid: true, discountPercent: 10, code: consent.discountCode });
    } catch (err) {
      console.error("Discount validate error:", err);
      res.status(500).json({ valid: false, message: "Something went wrong" });
    }
  });

  app.get("/api/consent/check", async (req: Request, res: Response) => {
    try {
      const consentType = (req.query.consentType as string) || "whatsapp_marketing";

      const customer = await getAuthenticatedCustomer(req);
      if (customer) {
        const consent = await storage.getCustomerConsentByEmail(customer.email, consentType);
        return res.json({ consented: !!consent });
      }

      const email = req.query.email as string;
      if (email) {
        const consent = await storage.getCustomerConsentByEmail(email.toLowerCase(), consentType);
        return res.json({ consented: !!consent });
      }

      res.json({ consented: false });
    } catch (err) {
      console.error("Consent check error:", err);
      res.json({ consented: false });
    }
  });
}
