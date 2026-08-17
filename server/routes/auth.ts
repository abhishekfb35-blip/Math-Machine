import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { notificationService } from "../providers/notification";
import { getCustomerToken, getAuthenticatedCustomer } from "./helpers";
import { OAuth2Client } from "google-auth-library";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createOtp(cleanEmail, otp, expiresAt);
      const result = await notificationService.sendOtpEmail(cleanEmail, otp);

      if (!result.success) {
        return res.status(500).json({ message: "Failed to send verification code" });
      }

      res.json({ success: true, message: "Verification code sent" });
    } catch (err) {
      console.error("Send OTP error:", err);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and code are required" });
      }
      const cleanEmail = email.trim().toLowerCase();

      const valid = await storage.verifyOtp(cleanEmail, otp);
      if (!valid) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      let customer = await storage.getCustomerByEmail(cleanEmail);
      if (!customer) {
        customer = await storage.createCustomer({ email: cleanEmail });
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("customer_token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      });

      res.json({ success: true, customer, token });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(customer);
  });

  app.patch("/api/auth/profile", async (req: Request, res: Response) => {
    try {
      const customer = await getAuthenticatedCustomer(req);
      if (!customer) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allowedFields = ["name", "phone", "shippingAddress", "shippingCity", "shippingState", "shippingPincode"];
      const updates: Record<string, string> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const updated = await storage.updateCustomer(customer.id, updates);
      res.json(updated);
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = getCustomerToken(req);
    if (token) {
      await storage.deleteCustomerSession(token);
    }
    res.clearCookie("customer_token", { path: "/" });
    res.json({ success: true });
  });

  app.get("/api/auth/orders", async (req: Request, res: Response) => {
    try {
      const customer = await getAuthenticatedCustomer(req);
      if (!customer) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const customerOrders = await storage.getOrdersByCustomerId(customer.id);

      const ordersWithItems = await Promise.all(
        customerOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );

      res.json(ordersWithItems);
    } catch (err) {
      console.error("Get customer orders error:", err);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/auth/google-client-id", (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    res.json({ clientId: clientId || null });
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential is required" });
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return res.status(500).json({ message: "Google Sign-In not configured" });
      }

      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(400).json({ message: "Invalid Google credential" });
      }

      const { sub: googleId, email, name, picture } = payload;
      if (!email) {
        return res.status(400).json({ message: "Email not available from Google" });
      }

      let customer = await storage.getCustomerByGoogleId(googleId);
      if (!customer) {
        customer = await storage.getCustomerByEmail(email);
        if (customer) {
          // Existing account linked by email — link Google ID and log in
          customer = await storage.updateCustomer(customer.id, {
            googleId,
            avatarUrl: picture,
            name: customer.name || name,
          });
        } else {
          // Brand-new user — ask the client for a phone number before creating the account
          const nameParts = (name || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          return res.json({
            needsPhone: true,
            googleData: { firstName, lastName, email },
          });
        }
      }

      if (!customer) {
        return res.status(500).json({ message: "Failed to create account" });
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("customer_token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      });

      res.json({ success: true, customer, token });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  /**
   * Complete Google sign-up for new users who provided their phone number.
   * Re-verifies the credential, creates the customer + consent record, and
   * opens a session — identical response shape to a successful /api/auth/google.
   */
  app.post("/api/auth/google/complete", async (req: Request, res: Response) => {
    try {
      const { credential, phone, consentGiven, consentText } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential is required" });
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return res.status(500).json({ message: "Google Sign-In not configured" });
      }

      // Re-verify credential (tokens are short-lived; we accept the same one)
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(400).json({ message: "Invalid Google credential" });
      }

      const { sub: googleId, email, name, picture } = payload;
      if (!email) {
        return res.status(400).json({ message: "Email not available from Google" });
      }

      const normalizedPhone = phone?.trim() || null;
      if (!normalizedPhone) {
        return res.status(400).json({ message: "Phone number is required to complete sign-up" });
      }

      // Guard against race conditions: customer may already exist
      let customer = await storage.getCustomerByGoogleId(googleId);
      if (!customer) {
        customer = await storage.getCustomerByEmail(email);
        if (customer) {
          customer = await storage.updateCustomer(customer.id, { googleId, avatarUrl: picture });
        } else {
          customer = await storage.createCustomer({
            email,
            name,
            googleId,
            avatarUrl: picture,
            phone: normalizedPhone,
          });
        }
      }

      if (!customer) {
        return res.status(500).json({ message: "Failed to create account" });
      }

      // Save phone on existing customer if not already set
      if (normalizedPhone && !customer.phone) {
        customer = await storage.updateCustomer(customer.id, { phone: normalizedPhone });
      }

      // Record marketing consent
      if (consentGiven) {
        const nameParts = (name || "").split(" ");
        const firstName = nameParts[0] || ".";
        const lastName = nameParts.slice(1).join(" ") || ".";
        const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
        try {
          await storage.createCustomerConsent({
            customerId: customer.id,
            firstName,
            lastName,
            email,
            phone: normalizedPhone,
            consentType: "whatsapp_marketing",
            consentGiven: true,
            discountCode: null,
            ipAddress: ip,
            userAgent: req.headers["user-agent"] || null,
            pageUrl: null,
            consentMethod: "google_signup",
            consentText: consentText || null,
          });
        } catch (consentErr) {
          // Non-fatal — account is created; log and continue
          console.error("Google signup consent record error:", consentErr);
        }
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.createCustomerSession(customer.id, token, expiresAt);

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("customer_token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      });

      res.json({ success: true, customer, token });
    } catch (err) {
      console.error("Google complete error:", err);
      res.status(500).json({ message: "Google sign-up failed" });
    }
  });
}
