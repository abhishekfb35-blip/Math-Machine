# Overview

This is the **Turtle Little** e-commerce web application — an online store selling personalised luxury embroidered towels and blankets. Customers can browse products by category, personalise items with a name to be embroidered, add to cart with automatic "Buy 2 Get 1 Free" discount, and place orders with shipping details.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Structure

The project follows a **monorepo layout** with three top-level source directories:

- **`client/`** — React frontend (SPA)
- **`server/`** — Express backend (REST API)
- **`shared/`** — Code shared between client and server (schema, route definitions, types)

### Frontend

- **Framework**: React with TypeScript
- **Bundler**: Vite (config in `vite.config.ts`, client root at `client/`)
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming, light mode default with dark mode support
- **Fonts**: Outfit (headings/body), DM Mono (monospace)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Frontend Pages

- **Home** (`/`) — Hero banner, audience cards (For Kids / For Couples), featured product sections, promo cards
- **Shop** (`/shop`) — Unified browsing with filter chips (All, Kids, Adults, Couples), full product catalog grouped by category
- **Category** (`/category/:slug`) — Product grid filtered by category, offer badge
- **Product Detail** (`/product/:slug`) — Image gallery, MRP/discount pricing, specifications grid, bullet points, feature badges, customer reviews, personalisation input, add-to-cart, related products
- **Cart** (`/cart`) — Cart items with quantity controls, discount display, order summary
- **Checkout** (`/checkout`) — Address form with validation, order summary sidebar
- **Order Confirmation** (`/order/:id`) — Order details, shipping info, item list with free items marked
- **Admin Builder** (`/admin/builder`) — Page builder for homepage layout, announcements, and dynamic homepage collections
- **Admin Catalog** (`/admin/catalog`) — CMS for managing categories and products: create, edit, delete categories; create, edit, delete products with full fields (price, MRP, specs, images, reviews, audience, product type, active status)

### UI Components

- **AnnouncementBar** — Scrolling marquee promo bar at top with "Buy 2 Get 1 Free", "Free shipping", "Personalised embroidery"
- **Header** — Minimal top bar with brand name, Shop nav link, theme toggle, cart icon with badge
- **BottomNav** — Mobile bottom navigation (Home, Shop, Cart tabs) — hidden on desktop
- **Footer** — Full footer with brand story, shop links, contact info (inverted bg-foreground/text-background)
- **ProductCardNew** — Product card with image, name, price, "Buy 2 Get 1 Free" badge, and "+" quick-add button
- **QuickAddSheet** — Bottom sheet for personalization name input and quantity when quick-adding to cart
- **WhatsAppButton** — Floating WhatsApp contact button, positioned above bottom nav on mobile

### Backend

- **Framework**: Express 5 on Node.js with cookie-parser middleware
- **Language**: TypeScript, executed via `tsx`
- **Cart Sessions**: Cookie-based (`cart_session` cookie, 30-day expiry)

### API Endpoints

- `GET /api/categories` — List all categories
- `GET /api/categories/:slug` — Get single category
- `GET /api/products` — List all active products
- `GET /api/products/category/:categoryId` — Products by category
- `GET /api/products/:slug` — Get single product
- `GET /api/cart` — Get current cart with items, pricing, and discount
- `POST /api/cart/items` — Add item to cart (productId, quantity, personalizationName)
- `PATCH /api/cart/items/:id` — Update cart item quantity
- `DELETE /api/cart/items/:id` — Remove item from cart
- `POST /api/checkout` — Place order with customer/shipping details
- `GET /api/orders/:id` — Get order with items
- `GET /api/site-config` — Get all site configuration (returns key-value JSON)
- `GET /api/site-config/:key` — Get single config by key
- `POST /api/site-config/:key` — Upsert config (body: { value: any })

### Shared Layer (`shared/`)

- **`types.ts`** — Pure TypeScript interfaces for all data models (Category, Product, Cart, CartItem, Order, OrderItem, SiteConfig) plus their Insert variants. **No database dependency.** All frontend and business logic imports types from here.
- **`schema.ts`** — Drizzle ORM table definitions (database-specific). Re-exports types from `types.ts` for backward compatibility. Only imported by server-side database code (`server/storage.ts`, `server/db.ts`, `server/seed.ts`).
- **`routes.ts`** — Zod validation schemas for cart and checkout inputs

### Architecture: Database Insulation

The codebase separates database-specific code from application logic:

- **`shared/types.ts`** — Database-agnostic data structures. If the database technology changes, this file stays untouched.
- **`shared/schema.ts`** — Drizzle/PostgreSQL table definitions. Only used by the storage layer on the server.
- **`server/storage.ts`** — `IStorage` interface defines all data operations using pure types from `types.ts`. `DatabaseStorage` class implements it using Drizzle. To swap databases, only this file and `schema.ts` need to change.
- **Frontend** — All client components import types from `@shared/types`, never from `@shared/schema`. Zero database dependency.

### Provider Abstraction Layer (`server/providers/`)

Three swappable provider interfaces insulate the application from infrastructure changes:

- **Payment (`IPaymentProvider`)** — Abstracts payment processing. Current: `CodPaymentProvider` (Cash on Delivery). To add Razorpay/Stripe, implement a new class and update the factory in `payment.ts`. Controlled by `PAYMENT_PROVIDER` env var.
- **File Storage (`IFileStorage`)** — Abstracts file uploads. Current: `LocalFileStorage` (disk-based). To switch to S3/Cloudflare R2, implement a new class and update the factory in `fileStorage.ts`. Controlled by `FILE_STORAGE_PROVIDER` env var.
- **Notifications (`INotificationService`)** — Abstracts order notifications. Current: `ConsoleNotificationService` (logs to console). To add email/SMS/WhatsApp API, implement a new class and update the factory in `notification.ts`. Controlled by `NOTIFICATION_PROVIDER` env var.

Each provider follows the same pattern: an interface, a default implementation, and a factory function that reads an env var to select the active provider. Routes only interact with the interface — never the concrete implementation.

### Service Layer (`server/services/`)

Business logic is separated from HTTP route handling into service classes:

- **`discountService.ts`** — Pure `calculateDiscount()` function implementing "Buy 2 Get 1 Free" logic. No dependencies on database, HTTP, or any framework.
- **`cartService.ts`** — `CartService` class handles cart operations: enriching items with product data, calculating pricing, adding/updating/removing items. Depends only on `IStorage` interface.
- **`orderService.ts`** — `OrderService` class orchestrates the full checkout flow: payment processing, order creation, free item marking, cart clearing, and notifications. Depends on `IStorage`, `IPaymentProvider`, and `INotificationService` interfaces.

Routes (`server/routes.ts`) are now thin HTTP handlers: they parse input, call a service method, and return the response. All business logic lives in the service layer.

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL, connected via `DATABASE_URL` environment variable
- **Tables**:
  - `categories` — id, name, slug, description, image_url, sort_order
  - `products` — id, name, slug, description, price (integer in INR), image_url, category_id, active, sort_order, search_keywords, and enrichment fields (mrp, material, gsm, dimensions, color, weight, bullet_points, special_features, audience, product_type)
  - `tags` — id, name (unique), description
  - `product_tags` — id, product_id, tag_id (many-to-many junction table)
  - `product_images` — id, product_id, image_url, sort_order, is_primary
  - `product_reviews` — id, product_id, reviewer_name, rating, title, body, review_date, verified_purchase
  - `carts` — id, session_id, created_at
  - `cart_items` — id, cart_id, product_id, quantity, personalization_name
  - `orders` — id, customer details, shipping address, subtotal, discount, total, status, payment fields, created_at
  - `order_items` — id, order_id, product snapshot, personalization_name, is_free
  - `site_config` — id, key (unique), value (JSON string)

### Product Categories (flat structure with tags for cross-cutting concerns)

1. Kids Bath Towels — 47 products
2. Adult Bath Towels — 8 products
3. Couple Bathrobes
4. Kids Blankets — 12 products
5. Kids Bathrobes — 6 products
6. Teen Bathrobes
7. Adult Bathrobes

### Tagging System

Products use a many-to-many tag system for cross-cutting attributes like design themes (Princess, Superhero, Animals, Cars), gender appeal (Boys, Girls, Unisex), and other filterable properties. Tags are managed in the Admin CMS and assigned to products via checkboxes.

### Discount Logic

"Buy 2 Get 1 Free" offer: When cart has 3+ items, the cheapest floor(N/2) items are free. Sort by price descending, mark the bottom half as free.
- 3 items → 1 free (pay for 2)
- 5 items → 2 free (pay for 3)
- 7 items → 3 free (pay for 4)
Minimum 3 items required to activate discount.

### Build System

- **Dev**: `npm run dev` runs the Express server with Vite middleware for HMR
- **Build**: `npm run build` runs a custom build script
- **Production**: `npm start` serves the pre-built client as static files

### PWA

The app includes PWA support with manifest.json, service worker, and app icons.

### Key Features

- Product personalisation (name embroidery input)
- Automatic discount calculation at cart level
- Floating WhatsApp contact button (99900 79722)
- Dark/light theme toggle
- Mobile responsive design
- Cookie-based cart persistence

## Recent Changes

- **Feb 2026**: Dynamic homepage collections system
  - Homepage card grid sections (e.g. "Shop by Collection", "Shop by Product") are now fully dynamic
  - Sections can be added, deleted, and reordered in admin builder
  - Cards within each section can be added and deleted
  - Last 3 deleted sections stored in history and can be restored
  - Unified config key "homepageCollections" with backward-compatible migration from old "collections"/"productTypes" keys
  - Image preview in admin builder shows actual default/fallback images
- **Feb 2026**: snaan.in-inspired premium design improvements
  - Scrolling announcement/promo bar above header
  - "The Turtle Little Promise" brand section (Premium Fabric, Hand Embroidered, Made with Love)
  - Customer testimonials section with reviews and star ratings
  - Stats bar (58+ Products, 5 Collections, All India Free Delivery)
  - Full footer with brand story, shop links, contact info
  - Editorial descriptions on category banners in Shop page
  - Promo CTA section highlighting "Buy 2 Get 1 Free" offer
  - Banner images throughout Home, Shop, and Category pages
- **Feb 2026**: UI redesign to app-style shopping experience
  - Bottom navigation bar on mobile (Home, Shop, Cart)
  - New unified Shop page with audience filter chips (All, Kids, Adults, Couples)
  - Quick-add feature: "+" button on product cards opens bottom sheet for personalization
  - Redesigned Home page with audience cards (For Kids, For Couples)
  - Related products section on product detail pages
  - Simplified header with minimal navigation
  - Fixed discount calculation to mark cheapest items as free
- **Feb 2026**: Bulk product import from Amazon Seller Central
  - 454 products imported from Excel inventory export (was 73)
  - All product data extracted: title, SKU, ASIN, description, bullet points, price, MRP, material, color, dimensions
  - 1,235 additional product images downloaded from Amazon CDN
  - All images auto-generated in 3 optimized sizes (small/medium/large)
  - GSM set by category: 500 (kids towels), 600 (adult towels), 360 (bathrobes)
  - Categories auto-mapped from product titles (towel, blanket, bathrobe + audience keywords)
  - 204 customer reviews scraped from Amazon.in across 41 products (avg 4.7 stars)
  - Import scripts in `scripts/` directory for re-running if needed
- **Feb 2026**: Complete rebuild from calculator app to Turtle Little e-commerce store
  - New database schema with 6 tables
  - Full shopping cart with discount logic
  - Checkout flow with order placement
  - WhatsApp integration
  - Teal/green branding with light/dark mode

### Image Optimization

Product images are served in 3 sizes for optimal performance:
- **Small** (150px wide, ~11KB) — Cart thumbnails, quick-add sheet, checkout items
- **Medium** (400px wide, ~78KB) — Product grid cards on Shop/Category/Home pages
- **Large** (original 567px wide, ~175KB) — Product detail page

Image files stored at:
- `client/public/images/products/small/`
- `client/public/images/products/medium/`
- `client/public/images/products/large/`

Frontend utility: `client/src/lib/imageUtils.ts` — `getProductImageUrl(imageUrl, "small" | "medium" | "large")` rewrites `/images/products/filename.jpg` to `/images/products/{size}/filename.jpg`. Uploaded images (`/uploads/...`) pass through unchanged.

## Future Work

- Razorpay payment integration
- Admin panel for product management
- Customer accounts and order history
- Product search
- Image migration to CDN
