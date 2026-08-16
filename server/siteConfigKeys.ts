/**
 * Canonical list of valid site_config keys and their consumers.
 *
 * Keys that belong in site_content (shared content synced dev → prod) are managed
 * separately in server/migrations/site-content-table.ts and are NOT listed here.
 *
 * Runtime / environment-specific keys that live in site_config:
 *
 *   guest-cart-cleanup          – { enabled, retentionDays }      server/index.ts + security route
 *   security-alert-config       – { alertEmail, alertThreshold, … } server/index.ts + security route
 *   notification-bcc-config     – { email, types }                server/providers/notification.ts
 *   admin-emails                – { emails[] }                    server/routes/admin/health.ts
 *   exchange-rate-alert-config  – { alertEmail, … }               server/services/exchangeRateService.ts
 *   cleanup-history             – array of cleanup log entries     server/services/cleanupHistory.ts
 *   rate-limits                 – { global, moderate, strict }     server/middleware/rateLimiter.ts
 *   abandoned_cart_emails_enabled – "true" | "false"              server/jobs/abandonedCart.ts
 *   abandoned_cart_recovery_code  – coupon code string            server/jobs/abandonedCart.ts
 *   pwa-install-banner          – { text, buttonText, customUrl } client Header + PWAInstallBanner
 *   stats                       – { items[] }                     client Home + AdminBuilder
 *   brand-logo-<slot>           – base64 image data               server/routes/admin/health.ts
 *   brand-pwa-favicon           – base64 image data               server/routes/admin/health.ts
 *   brand-pwa-icon-192          – base64 image data               server/routes/admin/health.ts
 *   brand-pwa-icon-512          – base64 image data               server/routes/admin/health.ts
 *   seed-hash-<table>           – content hash for seed idempotency server/seed.ts
 */
export const VALID_SITE_CONFIG_KEYS_PREFIX = [
  "brand-logo-",
  "brand-pwa-",
  "seed-hash-",
] as const;

export const VALID_SITE_CONFIG_KEYS = [
  "guest-cart-cleanup",
  "security-alert-config",
  "notification-bcc-config",
  "admin-emails",
  "exchange-rate-alert-config",
  "cleanup-history",
  "rate-limits",
  "abandoned_cart_emails_enabled",
  "abandoned_cart_recovery_code",
  "pwa-install-banner",
  "stats",
  "signup-popup",
] as const;
