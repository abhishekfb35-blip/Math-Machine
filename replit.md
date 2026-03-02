# Overview

This is the **Turtle Little** e-commerce web application, an online store selling personalised luxury embroidered towels and blankets. The platform enables customers to browse products, personalise items for embroidery, add them to a cart with automatic "Buy 2 Get 1 Free" discounts, and place orders with shipping details. The business vision is to provide a premium, app-style shopping experience with a focus on handcrafted quality and personalised products.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

The project employs a **monorepo layout** with distinct `client/` (React frontend), `server/` (Express backend), and `shared/` (common code) directories.

## Frontend

- **Framework**: React with TypeScript, bundled by Vite.
- **Routing**: Wouter for client-side routing.
- **State/Data Fetching**: TanStack React Query.
- **UI/Styling**: shadcn/ui built on Radix UI with Tailwind CSS, supporting light/dark modes.
- **Key Pages**:
    - **Home** (`/`): Dynamic hero banner, audience cards, featured products, promo cards.
    - **Shop** (`/shop`): Unified browsing with filter chips by audience.
    - **Product Detail** (`/product/:slug`): Image gallery, pricing, specifications, personalisation input, add-to-cart, related products.
    - **Cart** (`/cart`): Item management, discount display, order summary.
    - **Checkout** (`/checkout`): Address form and order summary.
    - **Order Confirmation** (`/order/:id`): Order details.
    - **Admin Dashboard** (`/admin`): Central entry point for all admin functions. Shows card grid linking to Catalog, Orders, Page Builder, Policy Pages, Health Checks, Audit Log, and Export Data. Login redirects here.
    - **Admin Builder** (`/admin/builder`): Dynamic homepage layout and collection management.
    - **Admin Catalog** (`/admin/catalog`): CMS for managing categories and products. Product list has checkboxes for bulk selection (up to 15) to open multiple products in new tabs for editing. Individual edit buttons also open in new tabs.
    - **Admin Product Edit** (`/admin/catalog/product/:id`): Standalone product editor opened in a new tab. Has Save and Save & Close (closes tab) buttons.
    - **Admin Orders** (`/admin/orders`): Order management with list view, status filters, search, order detail with items/address/payment, status updates (triggers customer email), and internal notes.
    - **Admin Audit Log** (`/admin/audit-log`): Timeline of all admin changes with entity type filtering and pagination.
    - **Admin Deploy Check** (`/admin/deploy-check`): Code health report — verifies production bundle includes all routes, static files, and checks if rebuild is needed.
    - **Admin Data Check** (`/admin/data-check`): Database health report — compares table structures against expected schema, shows row counts, data integrity issues, and site config completeness. Open on both dev and production to compare side by side.
- **Core UI Components**: AnnouncementBar, Header, BottomNav (mobile), Footer, ProductCardNew with quick-add, QuickAddSheet for personalization, and a floating WhatsAppButton.

## Backend

- **Framework**: Express 5 on Node.js with TypeScript.
- **Cart Sessions**: Cookie-based for persistence.
- **API Endpoints**: Comprehensive REST API for categories, products, cart management, checkout, orders, and site configuration.
- **Route Structure** (`server/routes/`): Modular route files, each exporting a `register*Routes(app)` function:
    - `helpers.ts` — Shared utilities: `getSessionId`, `getCustomerToken`, `getAuthenticatedCustomer`, `upload` (multer), `currentDir`.
    - `index.ts` — Master router that imports and registers all route groups.
    - `products.ts` — Public product/category/review/image endpoints.
    - `cart.ts` — Cart CRUD endpoints using `CartService`.
    - `checkout.ts` — Checkout, Razorpay, CCAvenue, order fetch, site-config endpoints.
    - `auth.ts` — Customer auth (OTP, Google OAuth, profile, order history).
    - `seo.ts` — `robots.txt` and `sitemap.xml` generation.
    - `admin/catalog.ts` — Admin CRUD for categories, products, images, reviews, tags.
    - `admin/orders.ts` — Admin auth (login/logout/check) and order management.
    - `admin/health.ts` — Deploy check, data check, SEO audit, data export, audit logs, file upload.
- **Entry point**: `server/routes.ts` re-exports `registerRoutes` from `server/routes/index.ts` for backward compatibility.

## Shared Layer (`shared/`)

- **`types.ts`**: Database-agnostic TypeScript interfaces for all data models, insulating application logic from database specifics.
- **`schema.ts`**: Drizzle ORM table definitions for PostgreSQL, used exclusively by the server's storage layer.
- **`routes.ts`**: Zod validation schemas for API inputs.

## Architecture Patterns

- **Database Insulation**: Separation of database-specific code (`shared/schema.ts`, `server/storage.ts`) from application logic (`shared/types.ts`) via an `IStorage` interface, allowing for database changes without impacting core business logic.
- **Provider Abstraction Layer (`server/providers/`)**: Swappable interfaces for Payment (`IPaymentProvider`), File Storage (`IFileStorage`), and Notifications (`INotificationService`), controlled by environment variables. Current implementations include `CodPaymentProvider` (Cash on Delivery), `LocalFileStorage`, and `ConsoleNotificationService`.
- **Service Layer (`server/services/`)**: Business logic (e.g., `discountService.ts`, `cartService.ts`, `orderService.ts`) is encapsulated in service classes, decoupling it from HTTP route handlers.

## Database

- **Environments**: Dev and production use **separate PostgreSQL databases**. The seed function (`server/seed.ts`) auto-syncs data (products, categories, reviews, images, tags, site config) on startup, but admin-created data (orders, uploaded images, etc.) is per-environment.
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **ID Strategy**: All tables use CUID2 string IDs (`@paralleldrive/cuid2`) instead of auto-increment integers. IDs are generated via `$defaultFn(() => createId())` in the schema.
- **Tables**: Includes `categories`, `products`, `tags`, `product_tags` (many-to-many), `product_images`, `product_reviews`, `carts`, `cart_items`, `orders`, `order_items`, `site_config`, `audit_logs`, and `customer_consents`.
- **Audit Log**: Tracks all admin changes (create/update/delete) for categories, products, tags, site config, and order status changes. Records entity type, entity ID/name, action, changed fields (JSON), username, and timestamp. Auto-prunes to keep only the 10 most recent entries per entity.
- **Product Categories**: Flat structure with a tagging system for cross-cutting attributes.
- **Timestamps**: Products, product_images, and orders have `created_at`/`updated_at`. Product_reviews and carts have `created_at` only. Storage layer auto-sets `updatedAt` on product/order updates.
- **Discount Logic**: "Buy 2 Get 1 Free" applied automatically, making the cheapest `floor(N/2)` items free for carts with 3+ items.

## Key Features

- Product personalisation (name embroidery).
- Automatic "Buy 2 Get 1 Free" discount.
- Floating WhatsApp contact button (99900 79722).
- Dark/light theme toggle and mobile-responsive design.
- Cookie-based cart persistence.
- Progressive Web App (PWA) support.
- Dynamic homepage content management.
- Comprehensive product data and customer reviews.
- Optimized product images for various sizes (Small, Medium, Large) served from `client/public/images/products/`.
- **Customer Authentication**: Email OTP (via Resend) + Google OAuth login. Customer sessions stored in `customer_sessions` table with httpOnly cookies. Customers can save profile/address (auto-fills checkout), view order history. Tables: `customers`, `customer_otps`, `customer_sessions`. Orders linked to customers via `customerId` field.
- **Key Auth Routes**: `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/google`, `/api/auth/me`, `/api/auth/profile`, `/api/auth/logout`, `/api/auth/orders`.
- **Auth Pages**: `/signin` (email OTP + Google), `/account` (profile + order history).
- **SEO**: Per-page titles, meta descriptions, canonical URLs, Open Graph tags, Twitter cards via react-helmet-async. JSON-LD structured data (Product, Organization, BreadcrumbList). Dynamic `/sitemap.xml` with 470+ URLs. `robots.txt` blocking admin/cart/checkout. OG image at `/og-image.png`.
- **Payments**: Dual payment system — Razorpay (online, HMAC-SHA256 verified) + COD. Razorpay order ID persisted in `razorpay_order_id` column. Test/live keys swappable via secrets.
- **Customer Consent & Discount**: Popup appears after 2 scrolls or 5 seconds for non-consented users. Collects first/last name, email, optional phone. Stores full compliance audit trail (IP, user agent, page URL, consent text, timestamp) in `customer_consents` table. Issues a one-time 10% discount code (TL10-XXXXXXXX) on opt-in. `discountCode` and `discountUsed` fields track redemption. Routes: `POST /api/consent`, `GET /api/consent/check`. Component: `ConsentPopup.tsx`. Rate-limited (10s per IP).
- **Google One Tap**: Automatic Google sign-in prompt on public pages for unauthenticated users. Component: `GoogleOneTap.tsx`.
- **Brand Assets**: Admin page (`/admin/brand`) for uploading 4 logo slots (desktop, mobile, favicon, footer). Logos stored as base64 in `site_config` DB and restored on server startup via `restoreBrandLogosFromDB()`. Favicon upload auto-generates PWA icons (32x32, 192x192, 512x512).

# External Dependencies

- **Database**: PostgreSQL
- **Frontend Libraries**: React, Vite, Wouter, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS
- **Backend Libraries**: Express, cookie-parser, tsx
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **SEO**: react-helmet-async for per-page meta tags, JSON-LD structured data (Product, Organization, BreadcrumbList), dynamic sitemap.xml, robots.txt
- **Payment Gateway**: CCAvenue (online payments, redirect-based flow) + Razorpay (online payments, modal-based) + CodPaymentProvider (Cash on Delivery). CCAvenue uses AES-128-CBC encryption with MD5-hashed working key. Configured via CCAVENUE_MERCHANT_ID, CCAVENUE_ACCESS_CODE, CCAVENUE_WORKING_KEY secrets. CCAVENUE_MODE env var controls test vs live (default: test). Both online payment options shown when configured; COD always available.
- **File Storage**: LocalFileStorage (disk-based)
- **Notifications**: ResendNotificationService (Resend API for transactional emails), falls back to ConsoleNotificationService if RESEND_API_KEY is not set
- **Email Integration**: Resend (resend.com) — sends order confirmation to customers and new order alerts to admin. Configured via RESEND_API_KEY secret, EMAIL_FROM and ADMIN_EMAIL env vars. From address: orders@turtlelittle.com (requires domain verification in Resend). Admin alerts go to hello@turtlelittle.com.