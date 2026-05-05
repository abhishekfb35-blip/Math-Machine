# Overview

**Turtle Little** is an e-commerce web application specializing in personalized luxury embroidered towels and blankets. The platform aims to deliver a premium, app-like shopping experience, allowing customers to browse, personalize products, manage a cart with automatic "Buy 2 Get 1 Free" discounts, and place orders. The core vision is to combine handcrafted quality with advanced personalization features, offering a unique market proposition in the personalized luxury goods sector.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

The project utilizes a **monorepo structure** comprising `client/` (React frontend), `server/` (Express backend), and `shared/` (common code) directories.

## Frontend

-   **Technology Stack**: React with TypeScript, bundled by Vite.
-   **UI/Styling**: shadcn/ui based on Radix UI and Tailwind CSS, supporting light/dark modes.
-   **Routing**: Wouter for client-side navigation.
-   **State Management/Data Fetching**: TanStack React Query.
-   **Key User-facing Pages**: Home, Shop, Product Detail, Cart, Checkout, Order Confirmation.
-   **Admin Dashboard**: A central interface for managing catalog, orders, page layouts, policy pages, health checks, audit logs, and data exports. Includes specialized tools like:
    -   **Admin Builder**: Dynamic homepage layout and collection management. Featured Sections panel lets admins configure per-section filters (category, age group, gender, theme, style, tags) with a live Preview button per section. The "See All" link is auto-derived from `categoryFilters` (1 category → `/category/{slug}`, else `/shop`).
    -   **Admin Catalog**: CMS for product and category management with bulk editing capabilities.
    -   **Admin Orders**: Order viewing, status updates, and internal notes.
    -   **Admin Health Checks**: Deploy and data integrity verification tools.
    -   **Admin DB Compare**: Tool to compare development and production database schemas and data for catalog tables.
    -   **Admin International Pricing**: Manages multi-currency exchange rates and pricing rules.
    -   **Admin Consent**: Configures and monitors consent popups and collected signups.
    -   **Admin Security**: Configures API rate limiting (global/moderate/strict tiers) and guest cart cleanup. Superadmin-only.
    -   **Admin Occasions**: CRUD management for merchandising occasions (boost/penalty tags, preferred themes/styles). Themes and styles option lists are sourced from `GET /api/attributes` (DB-backed, no hardcoded values). Routes: `GET/POST /api/admin/occasions`, `PATCH/DELETE /api/admin/occasions/:id`. Public: `GET /api/occasions`.
    -   **Admin Attributes**: CRUD management for product attribute lookup tables (age groups, genders, themes, styles). Routes: `GET/POST /api/admin/attributes/:type`, `PUT/DELETE /api/admin/attributes/:type/:id`. Product assignment: `GET/PUT /api/admin/products/:id/attributes`. Public: `GET /api/attributes`.
-   **Core UI Components**: Reusable components such as AnnouncementBar, Header (with CurrencySelector), BottomNav, Footer, ProductCardNew, QuickAddSheet for personalization, and a floating WhatsAppButton.
-   **Multi-Currency Support**: Frontend displays prices in multiple currencies based on user selection or IP detection, with conversion and formatting handled by `CurrencyContext`.

## Backend

-   **Technology Stack**: Express 5 on Node.js with TypeScript.
-   **API Endpoints**: A comprehensive REST API supporting categories, products, cart operations, checkout, orders, and site configuration.
-   **Modular Routing**: Routes are organized into distinct files within `server/routes/`, covering public and admin functionalities.
-   **Cart Management**: Cookie-based sessions for persistent cart data.

## Shared Layer (`shared/`)

-   **`types.ts`**: Defines database-agnostic TypeScript interfaces for all data models.
-   **`schema.ts`**: Contains Drizzle ORM table definitions for PostgreSQL.
-   **`routes.ts`**: Zod validation schemas for API request inputs.

## Architecture Patterns

-   **Database Insulation**: Achieved by separating database-specific logic from application logic using an `IStorage` interface.
-   **Provider Abstraction**: Utilizes swappable interfaces for Payment (`IPaymentProvider`), File Storage (`IFileStorage`), and Notifications (`INotificationService`), allowing for flexible integration of different services.
-   **Service Layer**: Business logic is encapsulated in service classes (e.g., `discountService.ts`, `cartService.ts`, `orderService.ts`) to maintain separation of concerns from HTTP handlers.

## Database

-   **Type**: PostgreSQL, with separate databases for development and production environments.
-   **ORM**: Drizzle ORM.
-   **ID Strategy**: Uses CUID2 string IDs for all tables.
-   **Key Tables**: `categories`, `products`, `tag_types`, `tags`, `product_tags`, `occasions`, `product_images`, `carts`, `orders`, `site_config`, `audit_logs`, `customer_consents`, `currency_rates`, `pricing_rules`, `category_variant_options`, `product_variants`, `customers`, `customer_otps`, `customer_sessions`, `age_groups`, `genders`, `themes`, `styles`, `product_age_groups`, `product_genders`, `product_themes`, `product_styles`.
-   **Audit Log**: Tracks all administrative changes with entity-specific details and auto-pruning.
-   **Product Attributes (normalized)**: Products no longer store flat `age_group`/`gender`/`themes`/`styles` text columns. Instead: 4 lookup tables (`age_groups`, `genders`, `themes`, `styles`) hold the valid values; 4 junction tables (`product_age_groups`, `product_genders`, `product_themes`, `product_styles`) link products to their attributes. Products are enriched at query time to return `ageGroups`/`genders`/`themes`/`styles` as string-name arrays. Managed via `AdminAttributes` page (`/admin/attributes`). No values are hardcoded in the UI — all options are fetched from `GET /api/attributes`.
-   **Product Images (single source of truth)**: `products.image_url` column has been dropped. All product thumbnails come from `product_images` WHERE `sort_order = 0`. The `Product.imageUrl` field on API responses is populated at query time by `withPrimaryImage()` in the storage layer. `InsertProduct.imageUrl` is still accepted as an optional field on create/update — it is stored into `product_images` as sort_order=0 but never written to the products table.
-   **Tag System**: `tag_types` table holds 6 admin-managed types (Merchandising, Occasion-fit, Risk/Suitability, Operational, Experimental/Growth, Use-Case/Structure). `tags` are internal merchandising signals (best_seller, bundle_friendly, etc.) — not user-facing filters. 25 initial tags seeded.
-   **Occasions**: `occasions` table stores merchandising engine config (boost/penalty tag weights, preferred themes/styles) for curating and ranking products externally. Managed via `AdminOccasions` page (`/admin/occasions`).
-   **Discount Logic**: Implements an automatic "Buy 2 Get 1 Free" discount on cart items.

## Key Features

-   **Product Personalization**: Supports name embroidery for products.
-   **Customer Authentication**: Google OAuth login with customer profiles and order history.
-   **SEO**: Dynamic sitemap, `robots.txt`, per-page metadata, canonical URLs, Open Graph, Twitter cards, and JSON-LD structured data.
-   **Payments**: Integrated with Razorpay for online transactions and supports Cash on Delivery (COD).
-   **Customer Consent & Discount**: Configurable consent popup with audit trail and a one-time 10% discount code for opt-ins.
-   **Brand Assets Management**: Admin interface for uploading and managing brand logos and favicons, dynamically generating PWA icons.
-   **PWA Support**: Progressive Web Application capabilities.
-   **Dynamic Content Management**: Homepage content managed via an admin interface.
-   **Optimized Images**: Product images served in various sizes.
-   **Configurable Offers & Delivery**: Admin-configurable buy-X-get-Y-free offer tiers using a greedy best-ratio algorithm, and domestic delivery fee tiers by item count. Both managed via `AdminOffers` page (`/admin/offers`). Backend in `discountService.ts` and `cartService.ts`; `orders` table has `shipping_fee` column.

# External Dependencies

-   **Database**: PostgreSQL
-   **Frontend Libraries**: React, Vite, Wouter, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS
-   **Backend Libraries**: Express, cookie-parser, tsx
-   **ORM**: Drizzle ORM
-   **Validation**: Zod
-   **SEO Tools**: react-helmet-async, sitemap.xml, robots.txt, JSON-LD
-   **Payment Gateway**: Razorpay (online payments)
-   **File Storage**: LocalFileStorage (disk-based)
-   **Email Service**: Resend (for transactional emails and admin alerts)