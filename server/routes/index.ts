import type { Express } from "express";
import type { Server } from "http";
import compression from "compression";
import { registerProductRoutes } from "./products";
import { registerHomeRoutes } from "./home";
import { registerCartRoutes } from "./cart";
import { registerCheckoutRoutes } from "./checkout";
import { registerAuthRoutes } from "./auth";
import { registerSeoRoutes } from "./seo";
import { registerConsentRoutes } from "./consent";
import { registerAdminCatalogRoutes } from "./admin/catalog";
import { registerAdminOrderRoutes } from "./admin/orders";
import { registerAdminHealthRoutes } from "./admin/health";
import { registerAdminConsentRoutes } from "./admin/consent";
import { registerAdminPricingRoutes } from "./admin/pricing";
import { registerAdminCustomerRoutes } from "./admin/customers";
import { registerAdminUserRoutes } from "./admin/users";
import { registerAdminSecurityRoutes } from "./admin/security";
import { registerWishlistRoutes } from "./wishlist";
import { globalLimiter, moderateLimiter, strictLimiter } from "../middleware/rateLimiter";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(compression());

  app.use("/api", globalLimiter);

  app.use([
    "/api/cart",
    "/api/wishlist",
  ], moderateLimiter);

  app.use([
    "/api/auth/send-otp",
    "/api/auth/verify-otp",
    "/api/auth/google",
    "/api/checkout",
    "/api/razorpay/create-order",
    "/api/consent",
    "/api/discount/validate",
  ], strictLimiter);

  registerSeoRoutes(app);
  registerHomeRoutes(app);
  registerProductRoutes(app);
  registerCartRoutes(app);
  registerCheckoutRoutes(app);
  registerAuthRoutes(app);
  registerConsentRoutes(app);
  registerAdminOrderRoutes(app);
  registerAdminHealthRoutes(app);
  registerAdminConsentRoutes(app);
  registerAdminCatalogRoutes(app);
  registerAdminPricingRoutes(app);
  registerAdminCustomerRoutes(app);
  registerAdminUserRoutes(app);
  registerAdminSecurityRoutes(app);
  registerWishlistRoutes(app);

  return httpServer;
}
