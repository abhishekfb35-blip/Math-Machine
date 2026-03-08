import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { getAuthenticatedCustomer } from "./helpers";
import { notificationService } from "../providers/notification";

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

      if (!consentType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const normalizedEmail = email?.trim()?.toLowerCase() || null;
      const normalizedPhone = phone?.trim() || null;

      if (normalizedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          return res.status(400).json({ message: "Invalid email address" });
        }

        const existingByEmail = await storage.getCustomerConsentByEmail(normalizedEmail, consentType);
        if (existingByEmail) {
          res.cookie("consent_given", normalizedEmail, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 365 * 24 * 60 * 60 * 1000,
            sameSite: "lax",
            path: "/",
          });
          return res.json({
            alreadyExists: true,
            discountCode: existingByEmail.discountUsed ? null : existingByEmail.discountCode,
            discountUsed: !!existingByEmail.discountUsed,
            message: existingByEmail.discountUsed
              ? "This email has already been submitted and the coupon has been utilized."
              : "This email has already been submitted for the offer.",
          });
        }
      }

      if (normalizedPhone) {
        const existingByPhone = await storage.getCustomerConsentByPhone(normalizedPhone, consentType);
        if (existingByPhone) {
          const cookieVal = normalizedEmail || `phone:${normalizedPhone}`;
          res.cookie("consent_given", cookieVal, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 365 * 24 * 60 * 60 * 1000,
            sameSite: "lax",
            path: "/",
          });
          return res.json({
            alreadyExists: true,
            discountCode: existingByPhone.discountUsed ? null : existingByPhone.discountCode,
            discountUsed: !!existingByPhone.discountUsed,
            message: existingByPhone.discountUsed
              ? "This phone number has already been submitted and the coupon has been utilized."
              : "This phone number has already been submitted for the offer.",
          });
        }
      }

      const customer = await getAuthenticatedCustomer(req);
      const discountCode = consentGiven ? generateDiscountCode() : null;

      const consent = await storage.createCustomerConsent({
        customerId: customer?.id || null,
        firstName: (firstName?.trim()) || ".",
        lastName: (lastName?.trim()) || ".",
        email: normalizedEmail || "unknown",
        phone: normalizedPhone,
        consentType,
        consentGiven: !!consentGiven,
        discountCode,
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || null,
        pageUrl: pageUrl || null,
        consentMethod: "popup_form",
        consentText: consentText || null,
      });

      const cookieVal = normalizedEmail || (normalizedPhone ? `phone:${normalizedPhone}` : null);
      if (cookieVal) {
        res.cookie("consent_given", cookieVal, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 365 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
          path: "/",
        });
      }

      const recipientEmail = normalizedEmail || customer?.email;
      if (recipientEmail && consent.discountCode) {
        let discountPercent = 10;
        try {
          const config = await storage.getSiteConfig("consent-popup");
          if (config?.value?.discountPercent) {
            discountPercent = config.value.discountPercent;
          }
        } catch {}
        const name = (firstName?.trim()) || customer?.name?.split(" ")[0] || "";
        console.log(`[consent] Sending welcome coupon email to ${recipientEmail} with code ${consent.discountCode}`);
        notificationService.sendWelcomeCoupon(recipientEmail, name, consent.discountCode, discountPercent)
          .then(result => console.log(`[consent] Welcome coupon email result:`, JSON.stringify(result)))
          .catch(err => console.error("[consent] Failed to send welcome coupon email:", err));
      } else {
        console.log(`[consent] No email to send welcome coupon to. recipientEmail=${recipientEmail}, discountCode=${consent.discountCode}`);
      }

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
        const orderWithCode = await storage.getOrderByDiscountCode(consent.discountCode!);
        if (!orderWithCode || (orderWithCode.paymentStatus !== "paid" && orderWithCode.status === "cancelled")) {
          await storage.resetConsentDiscountUsed(consent.id);
        } else {
          return res.json({ valid: false, message: "This discount code has already been used" });
        }
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

      const consentCookie = req.cookies?.consent_given;
      if (consentCookie) {
        if (consentCookie.startsWith("phone:")) {
          const phone = consentCookie.slice(6);
          const consent = await storage.getCustomerConsentByPhone(phone, consentType);
          return res.json({ consented: !!consent });
        }
        const consent = await storage.getCustomerConsentByEmail(consentCookie, consentType);
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
